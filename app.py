# app.py

from flask import Flask, render_template, request, redirect, url_for, jsonify
from wtforms import Form,StringField,TextAreaField,PasswordField,validators

app = Flask(__name__)
app.config['SECRET_KEY'] = 'kanban_project'

class TaskForm(Form):
    title = StringField('Task Title:', validators=[validators.Length(max=100)])
    description = TextAreaField('Task Description (optional):')

tasks = {
    "todo": [],
    "in_progress": [],
    "done": []
}

task_id_counter = 0

def get_next_task_id():
    global task_id_counter
    task_id_counter += 1
    return task_id_counter

def find_task_by_id(task_id):
    for column_name, column_tasks in tasks.items():
        for task in column_tasks:
            if task["id"] == task_id:
                return task, column_name
    return None, None

@app.route("/")
def index():
    form = TaskForm(request.form)
    return render_template("index.html", tasks=tasks, form=form)

@app.route("/add", methods=["POST"])
def add_task():
    form = TaskForm(request.form)

    if form.validate():
        title = form.title.data
        description = form.description.data
        new_id = get_next_task_id()
        task = {"id": new_id, "title": title, "desc": description}
        tasks["todo"].append(task)

        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"success": True, "task": task})

        return redirect(url_for("index"))
    else:
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"success": False, "errors": form.errors}), 400

        return render_template("index.html", tasks=tasks, form=form)


@app.route("/move_task", methods=["POST"])
def move_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_column = data.get("new_column")
    original_column = data.get("original_column")

    if not all([task_id, new_column, original_column]):
        return jsonify({"error": "Missing data for move operation"}), 400

    moved_task = None

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task_id format"}), 400

    for i, task in enumerate(tasks[original_column]):
        if task["id"] == task_id:
            moved_task = tasks[original_column].pop(i)
            break

    if moved_task:
        tasks[new_column].append(moved_task)
        return jsonify({"message": "Task moved successfully", "task": moved_task}), 200
    
    return jsonify({"error": "Task not found in original column"}), 404


@app.route("/edit_task", methods=["POST"])
def edit_task():
    data = request.get_json()
    task_id = data.get("task_id")
    new_title = data.get("title")
    new_description = data.get("description")

    if not all([task_id, new_title is not None, new_description is not None]):
        return jsonify({"error": "Missing data for edit operation"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task_id format"}), 400

    found_task, column_name = find_task_by_id(task_id)

    if found_task:
        found_task["title"] = new_title
        found_task["desc"] = new_description
        return jsonify({"success": True, "task": found_task}), 200
    else:
        return jsonify({"error": "Task not found"}), 404


@app.route("/delete_task", methods=["POST"])
def delete_task():
    data = request.get_json()
    task_id = data.get("task_id")

    if not task_id:
        return jsonify({"error": "Missing task_id for delete operation"}), 400

    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task_id format"}), 400

    deleted = False
    for column_name in tasks:
        original_len = len(tasks[column_name])
        tasks[column_name] = [task for task in tasks[column_name] if task["id"] != task_id]
        if len(tasks[column_name]) < original_len:
            deleted = True
            break

    if deleted:
        return jsonify({"success": True, "message": "Task deleted successfully"}), 200
    else:
        return jsonify({"error": "Task not found"}), 404


if __name__ == "__main__":
    app.run(debug=True)