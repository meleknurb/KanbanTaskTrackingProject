from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
from flask_wtf.csrf import CSRFProtect
from flask_login import login_user, logout_user, current_user, login_required
from models import db, User, Task, login_manager
# UpdateUsernameForm'u import listesinden kaldırıyoruz
from forms import RegisterForm, LoginForm, TaskForm, UpdateEmailForm, UpdatePasswordForm
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates'),
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')
)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager.init_app(app)
login_manager.login_view = 'login'

csrf = CSRFProtect(app)

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        email = form.email.data
        password = form.password.data

        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get('next')
            flash('Login successful!', 'success')
            return redirect(next_page or url_for('dashboard'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.html', form=form)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = RegisterForm()
    if form.validate_on_submit():
        # username = form.username.data # KALDIRILDI
        email = form.email.data
        password = form.password.data

        existing_user_email = User.query.filter_by(email=email).first()
        # existing_user_username = User.query.filter_by(username=username).first() # KALDIRILDI

        if existing_user_email:
            flash('That email is already taken. Please choose a different one.', 'warning')
        # elif existing_user_username: # KALDIRILDI
        #    flash('That username is already taken. Please choose a different one.', 'warning') # KALDIRILDI
        else:
            # new_user = User(email=email, username=username) # username kaldırıldı
            new_user = User(email=email) # Sadece email ile kullanıcı oluştur
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            flash('Your account has been created! You are now able to log in', 'success')
            login_user(new_user)
            return redirect(url_for('dashboard'))

    return render_template('register.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

@app.route("/dashboard")
@login_required
def dashboard():
    user_id = current_user.id

    tasks_by_status = {
        "todo": [],
        "in_progress": [],
        "done": []
    }

    try:
        user_tasks = Task.query.filter_by(user_id=user_id).order_by(Task.id.asc()).all()

        for task in user_tasks:
            if task.status in tasks_by_status:
                tasks_by_status[task.status].append({
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status,
                    "user_id": task.user_id
                })
            else:
                tasks_by_status['todo'].append({
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": 'todo',
                    "user_id": task.user_id
                })

    except Exception as e:
        app.logger.error(f"Error fetching tasks for user {user_id}: {e}")
        flash('An error occurred while loading your tasks.', 'danger')

    form = TaskForm()
    # current_user.username artık olmayacağı için, kullanıcı adını gösteren bir yer varsa kaldırılmalı
    # Eğer dashboard'da kullanıcı adını göstermiyorsan, bu satırı olduğu gibi bırakabilirsin.
    # user_email'ı şablona göndermeye devam edebiliriz.
    return render_template("dashboard.html", tasks=tasks_by_status, form=form, user_email=current_user.email)


@app.route("/add_task", methods=["POST"])
@login_required
def add_task():
    form = TaskForm()
    if form.validate_on_submit():
        title = form.title.data
        description = form.description.data

        new_task = Task(
            title=title,
            description=description,
            status="todo",
            user_id=current_user.id
        )
        db.session.add(new_task)
        db.session.commit()
        flash('Task added successfully!', 'success')

        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({
                "success": True,
                "task": {
                    "id": new_task.id,
                    "title": new_task.title,
                    "description": new_task.description,
                    "status": new_task.status
                }
            })
        return redirect(url_for("dashboard"))
    else:
        if form.errors:
            for field, errors in form.errors.items():
                for error in errors:
                    flash(f"Error in {field}: {error}", 'danger')

        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"success": False, "errors": form.errors}), 400
        return redirect(url_for("dashboard"))


@app.route("/move_task", methods=["POST"])
@login_required
def move_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_status = data.get("new_status")

    if not all([task_id, new_status]):
        return jsonify({"error": "Missing data: Information required to carry out a task is missing"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        task.status = new_status
        db.session.commit()
        flash('Task status updated successfully!', 'success')
        return jsonify({
            "task": {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status
            }
        }), 200
    else:
        flash('Task not found or not authorized to move.', 'danger')
        return jsonify({"error": "Task not found or not yours"}), 404

@app.route("/edit_task", methods=["POST"])
@login_required
def edit_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_title = data.get("title")
    new_description = data.get("description")

    if not all([task_id, new_title is not None, new_description is not None]):
        return jsonify({"error": "Missing data: Information required to organise a task is missing"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        task.title = new_title
        task.description = new_description
        db.session.commit()
        flash('Task updated successfully!', 'success')
        return jsonify({
            "success": True,
            "task": {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status
            }
        }), 200
    else:
        flash('Task not found or not authorized to edit.', 'danger')
        return jsonify({"error": "Task not found or not yours"}), 404


@app.route("/delete_task", methods=["POST"])
@login_required
def delete_task():
    data = request.get_json()
    task_id = data.get("task_id")

    if not task_id:
        return jsonify({"error": "Missing task ID: Task_id required to delete task"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        db.session.delete(task)
        db.session.commit()
        flash('Task deleted successfully!', 'success')
        return jsonify({"success": True}), 200
    else:
        flash('Task not found or not authorized to delete.', 'danger')
        return jsonify({"error": "Task not found or not yours"}), 404

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    email_form = UpdateEmailForm()
    password_form = UpdatePasswordForm()
    if email_form.validate_on_submit() and email_form.submit.name in request.form:
        new_email = email_form.email.data
        current_password_for_email = email_form.confirm_password.data

        if not current_user.check_password(current_password_for_email):
            flash('Incorrect password for email update. Please try again.', 'danger')
            return redirect(url_for('settings'))

        if new_email != current_user.email:
            existing_user_with_new_email = User.query.filter_by(email=new_email).first()
            if existing_user_with_new_email:
                flash('That email address is already in use. Please choose a different one.', 'warning')
                return redirect(url_for('settings'))

        current_user.email = new_email
        db.session.commit()
        flash('Your email address has been updated successfully!', 'success')
        return redirect(url_for('settings'))

    if password_form.validate_on_submit() and password_form.submit.name in request.form:
        current_password_for_password = password_form.current_password.data
        new_password = password_form.new_password.data

        if not current_user.check_password(current_password_for_password):
            flash('Incorrect current password for password update. Please try again.', 'danger')
            return redirect(url_for('settings'))

        current_user.set_password(new_password)
        db.session.commit()
        flash('Your password has been updated successfully!', 'success')
        return redirect(url_for('settings'))

    return render_template(
        'settings.html',
        user=current_user,
        email_form=email_form,
        password_form=password_form
    )

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    # current_user'ın ID'sini logout_user() çağrısından önce al
    user_id_to_delete = current_user.id
    
    # Kullanıcının oturumunu kapat
    logout_user()

    # Kullanıcıyı veritabanından çek (çünkü current_user artık AnonymousUserMixin)
    user_to_delete = User.query.get(user_id_to_delete)

    if user_to_delete:
        # Kullanıcıya ait tüm görevleri sil
        Task.query.filter_by(user_id=user_to_delete.id).delete()
        
        # Kullanıcıyı sil
        db.session.delete(user_to_delete)
        db.session.commit()
        flash('Your account has been successfully deleted.', 'info')
    else:
        # Bu duruma normalde düşmemeli ama her ihtimale karşı
        flash('Failed to delete account. User not found.', 'danger')
    
    return redirect(url_for('index'))


if __name__ == "__main__":
    #with app.app_context():
    #   db.create_all()
    #   print("Database tables have been created")
    app.run(debug=True)