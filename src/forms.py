# src/forms.py

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Email, Length, EqualTo, ValidationError

class RegisterForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email('Please enter a valid email address.')])
    password = PasswordField('Password', validators=[DataRequired('Please enter a password.'), Length(min=5, message='Password must be at least 5 characters long.')])
    submit = SubmitField('Sign Up')

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email('Please enter a valid email address.')])
    password = PasswordField('Password', validators=[DataRequired('Please enter your password.')])
    submit = SubmitField('Sign In')

class TaskForm(FlaskForm):
    title = StringField('Task Title:', validators=[Length(max=100)])
    description = TextAreaField('Task Description (optional):')
    submit = SubmitField('Add Task')

class UpdateEmailForm(FlaskForm):
    email = StringField('New Email', validators=[DataRequired(), Email('Please enter a valid email address.')])
    confirm_password = PasswordField('Confirm Your Password', validators=[DataRequired()])
    submit = SubmitField('Save Email')

class UpdatePasswordForm(FlaskForm):
    current_password = PasswordField('Current Password', validators=[DataRequired()])
    new_password = PasswordField('New Password', validators=[
        DataRequired('Please enter a new password.'),
        Length(min=5, message='Password must be at least 5 characters long.')
    ])
    confirm_new_password = PasswordField('Confirm New Password', validators=[
        DataRequired('Please confirm your new password.'),
        EqualTo('new_password', message='New passwords must match.')
    ])
    submit = SubmitField('Save Password')