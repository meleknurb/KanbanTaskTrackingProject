# TASKFLOW

A minimalistic and user-friendly Kanban board application. Easily manage tasks, track their status and increase your productivity. This project offers user authentication, task management and an intuitive interface.

---

## Live Version

You can review the working version of the project here:

**[https://taskflow-pfct.onrender.com/]**

---

## Features

* **User Authentication:** Personal Kanban boards with secure registration and login system.
* **Task Creation:** Add new tasks with title and detailed description. Rich text editor (CKEditor) support is available for descriptions.
* **Task Management:** View tasks according to their status (To Do, In Progress, Completed).
* **Drag-and-Drop Functionality:** Easily drag and drop tasks between columns to update their status.
* **Task Edit:** Edit the title and description of existing tasks.
* **Delete Tasks:** Remove unwanted tasks from the dashboard.
* **Settings:** Users can update their email addresses and passwords or delete their accounts.
* **Responsive Design:** Responsive interface for a smooth experience on various devices.
**Notification System:** Notifications that provide feedback to the user for successful transactions and errors.

---

## Technologies Used

**Backend (Server Side):**

* **Python:** Main programming language.
* **Flask:** Web application framework.
* **Flask-SQLAlchemy:** Flask extension for SQLAlchemy ORM, used for database interactions.
* **Flask-Login:** Used for managing user sessions.
* **Flask-WTF:** Flask-WTF provides form validation and CSRF protection.
* **Werkzeug Security:** Used for password hashing and authentication.
* **python-dotenv:** Used to manage environment variables.
* **SQLite:** A lightweight, file-based database for the development environment (by default).

**Frontend (Client Side):**

* **HTML5:** Structural skeleton of the application.
* **CSS3:** The styling and layout of the application.
* **JavaScript (Vanilla JS):** Dynamic user interactions, AJAX requests and task management logic.
* **CKEditor 5:** Rich text editor for task descriptions.
* **Font Awesome/Bootstrap Icons:** for edit and delete icons (added via SVG).

---

## Installation and Operation

Follow the steps below to install and run the project on your local machine:

1. **Clone the repository:**
 ```bash
 git clone https://github.com/meleknurb/KanbanTaskTrackingProject.git

 cd KanbanTaskTrackingProject
 ```

 2. **Create and Activate a Virtual Environment:**
 ```bash
 python -m venv venv
    # For Windows:
    .\venv\Scripts\activate
    # for macOS / Linux:
    source venv/bin/activate
 ```

 3. **Install Required Packages:**
 ```bash
 pip install -r requirements.txt
 ```

 4. **Set Environment Variables:**
 Create a file named `.env` in the project root directory and add the following lines. Replace `YOUR_SECRET_KEY` with a strong and random key and `sqlite:///site.db` with your preferred database URI (e.g. `postgresql://user:password@host:port/dbname` for PostgreSQL).
``` bash dotenv
 SECRET_KEY='YOUR_SECRET_KEY'
 DATABASE_URL='sqlite:///site.db'
 ```

 5.  **Run Application:**
```bash
    flask run
```

6. You can access the application by going to `http://127.0.0.1:5000/` in your browser.

---

## Usage

1. **Register / Login:** Create a new account or login with your existing account to access the application.
2. **Add Task:** Create new tasks by entering the task title and optional description (using a rich text editor) from the ‘Add Task’ section. New tasks will be automatically added to the ‘To Do’ column.
3. **Move Tasks:** Drag and drop task cards between the ‘To Do’, ‘In Progress’ and ‘Done’ columns to update their status.
4. **View Tasks:** Click on a task to view its detailed title and description content in a modal window.
5. **Edit Tasks:** Update the title and description of a task by clicking the edit (pencil) icon in the upper right corner of a task card.
6. **Delete Tasks:** Delete a task by clicking the trash can icon in the upper right corner of a task card.
7. **Settings:** Click on the ‘Settings’ link in the left sidebar to change your email address or password, or delete your account.
8. **Sidebar:** Use the arrow button at the top to switch the left sidebar on and off.

---

## Licence

This project is licensed under the **MIT Licence**. See `LICENSE` file for details.
