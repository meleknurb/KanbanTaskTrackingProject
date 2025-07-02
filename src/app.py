# src/app.py

from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_wtf.csrf import CSRFProtect
from flask_login import login_user, logout_user, current_user, login_required
from .models import db, User, Task, login_manager
from .forms import RegisterForm, LoginForm, TaskForm, UpdateEmailForm, UpdatePasswordForm
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
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            form.email.data = data.get('email')
            form.password.data = data.get('password')
            if 'csrf_token' in data:
                form.csrf_token.data = data.get('csrf_token')

        if form.validate_on_submit() or (request.is_json and form.validate()):
            email = form.email.data
            password = form.password.data

            user = User.query.filter_by(email=email).first()
            if user and user.check_password(password):
                login_user(user)
                next_page = request.args.get('next') or url_for('dashboard')
                return redirect(next_page)
            else:
                return jsonify({"success": False, "message": "Email or password is incorrect. Please try again."}), 401
        else:
            errors = {field: errors for field, errors in form.errors.items()}
            return jsonify({"success": False, "message": "Validation failed.", "errors": errors}), 400
    
    return render_template('login.html', form=form)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = RegisterForm()
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            form.email.data = data.get('email')
            form.password.data = data.get('password')

        if form.validate_on_submit() or (request.is_json and form.validate()):
            email = form.email.data
            password = form.password.data

            existing_user_email = User.query.filter_by(email=email).first()

            if existing_user_email:
                return jsonify({"success": False, "message": "That email is already taken. Please choose a different one."}), 409
            else:
                new_user = User(email=email)
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.commit()
                login_user(new_user)
                return redirect(url_for('dashboard'))
        else:
            errors = {field: errors for field, errors in form.errors.items()}
            return jsonify({"success": False, "message": "Validation failed.", "errors": errors}), 400

    return render_template('register.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
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
        pass 

    form = TaskForm()
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
        return jsonify({
            "success": True,
            "message": "Task added successfully!",
            "task": {
                "id": new_task.id,
                "title": new_task.title,
                "description": new_task.description,
                "status": new_task.status
            }
        })
    else:
        errors = {field: errors for field, errors in form.errors.items()}
        return jsonify({"success": False, "message": "Validation failed.", "errors": errors}), 400


@app.route("/move_task", methods=["POST"])
@login_required
def move_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_status = data.get("new_status")

    if not all([task_id, new_status]):
        return jsonify({"success": False, "message": "Missing data: Information required to carry out a task is missing"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        task.status = new_status
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Task status updated successfully!",
            "task": {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status
            }
        }), 200
    else:
        return jsonify({"success": False, "message": "Task not found or not yours"}), 404

@app.route("/edit_task", methods=["POST"])
@login_required
def edit_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_title = data.get("title")
    new_description = data.get("description")

    if not all([task_id, new_title is not None, new_description is not None]):
        return jsonify({"success": False, "message": "Missing data: Information required to organise a task is missing"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        task.title = new_title
        task.description = new_description
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Task updated successfully!",
            "task": {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status
            }
        }), 200
    else:
        return jsonify({"success": False, "message": "Task not found or not yours"}), 404


@app.route("/delete_task", methods=["POST"])
@login_required
def delete_task():
    data = request.get_json()
    task_id = data.get("task_id")

    if not task_id:
        return jsonify({"success": False, "message": "Missing task ID: Task_id required to delete task"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid task ID format"}), 400

    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()

    if task:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"success": True, "message": "Task deleted successfully!"}), 200
    else:
        return jsonify({"success": False, "message": "Task not found or not yours"}), 404
    

@app.route('/settings', methods=['GET'])
@login_required
def settings():
    email_form = UpdateEmailForm()
    password_form = UpdatePasswordForm()
    return render_template(
        'settings.html',
        user=current_user,
        email_form=email_form,
        password_form=password_form
    )

@app.route('/update_email', methods=['POST'])
@login_required
def update_email():
    email_form = UpdateEmailForm()
    if request.is_json:
        data = request.get_json()
        email_form.email.data = data.get('email')
        email_form.confirm_password.data = data.get('confirm_password')
        if 'csrf_token' in data:
            email_form.csrf_token.data = data.get('csrf_token')

    if email_form.validate():
        if not current_user.check_password(email_form.confirm_password.data):
            return jsonify({"success": False, "message": "Incorrect password for email update. Please try again."}), 401

        if email_form.email.data != current_user.email:
            existing_user_with_new_email = User.query.filter_by(email=email_form.email.data).first()
            if existing_user_with_new_email and existing_user_with_new_email.id != current_user.id:
                return jsonify({"success": False, "message": "That email address is already in use. Please choose a different one."}), 409

        current_user.email = email_form.email.data
        db.session.commit()
        return jsonify({"success": True, "message": "Your email address has been updated successfully!"})
    else:
        errors = {field: errors for field, errors in email_form.errors.items()}
        return jsonify({"success": False, "message": "Validation failed for email update.", "errors": errors}), 400

@app.route('/update_password', methods=['POST'])
@login_required
def update_password():
    password_form = UpdatePasswordForm()
    if request.is_json:
        data = request.get_json()
        password_form.current_password.data = data.get('current_password')
        password_form.new_password.data = data.get('new_password')
        password_form.confirm_new_password.data = data.get('confirm_new_password')
        if 'csrf_token' in data:
            password_form.csrf_token.data = data.get('csrf_token')

    if password_form.validate():
        if not current_user.check_password(password_form.current_password.data):
            return jsonify({"success": False, "message": "Incorrect current password for password update. Please try again."}), 401

        current_user.set_password(password_form.new_password.data)
        db.session.commit()
        return jsonify({"success": True, "message": "Your password has been updated successfully!"})
    else:
        errors = {field: errors for field, errors in password_form.errors.items()}
        return jsonify({"success": False, "message": "Validation failed for password update.", "errors": errors}), 400

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    user_id_to_delete = current_user.id
    
    logout_user()

    user_to_delete = User.query.get(user_id_to_delete)

    if user_to_delete:
        Task.query.filter_by(user_id=user_to_delete.id).delete()
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({"success": True, "message": "Your account has been successfully deleted."})
    else:
        return jsonify({"success": False, "message": "Failed to delete account. User not found."}), 404


if __name__ == "__main__":
    #with app.app_context():
    #   db.create_all()
    #   print("Database tables have been created")
    app.run(debug=False)
