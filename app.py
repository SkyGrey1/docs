import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, current_user, login_user, logout_user, login_required
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from textblob import TextBlob
from datetime import datetime, time, date, timedelta
from functools import wraps
import click

from config import Config

# --- App Initialization & Extensions ---
app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login = LoginManager(app)
login.login_view = 'api_login'
socketio = SocketIO(app, cors_allowed_origins="*")
mail = Mail(app)

# --- Models (as defined previously) ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True, nullable=False)
    email = db.Column(db.String(120), index=True, unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(120))
    role = db.Column(db.String(20), index=True, nullable=False)
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

class Queue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    queue_number = db.Column(db.String(20), index=True, nullable=False)
    student_email = db.Column(db.String(120))
    status = db.Column(db.String(20), index=True, default='waiting', nullable=False)
    created_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'), nullable=False)

class Feedback(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    sentiment = db.Column(db.Float, nullable=True)
    queue_id = db.Column(db.Integer, db.ForeignKey('queue.id'), nullable=False)

# ... other models ...
@login.user_loader
def load_user(id): return User.query.get(int(id))

# --- Main Route & Helpers ---
@app.route('/')
def index(): return render_template('index.html')

def broadcast_update():
    # ... as before ...
    pass

def send_email(subject, recipients, text_body, html_body):
    """Placeholder for sending email."""
    # In a real app, this would use Flask-Mail:
    # msg = Message(subject, sender=app.config['ADMINS'][0], recipients=recipients)
    # msg.body = text_body
    # msg.html = html_body
    # mail.send(msg)
    print(f"--- MOCK EMAIL ---\nTo: {recipients}\nSubject: {subject}\nBody: {text_body}\n--- END MOCK EMAIL ---")


# --- API Routes ---

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user is None or not user.check_password(data.get('password')):
        return jsonify(error='Invalid username or password'), 401
    login_user(user, remember=True)
    return jsonify(success=True, user={'role': user.role, 'name': user.full_name})

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify(success=True)

@app.route('/api/queue', methods=['POST'])
def api_create_queue():
    # ... logic from previous step ...
    data = request.get_json()
    # Assuming queue 'q' is created...
    q = Queue(student_email=data['email'], service_id=data['serviceId'], queue_number="TEMP")
    send_email(
        'Your Queue Number',
        recipients=[q.student_email],
        text_body=f'Your queue number is {q.queue_number}.',
        html_body=f'<p>Your queue number is <b>{q.queue_number}</b>.</p>'
    )
    # ... rest of the logic ...
    return jsonify(success=True), 201

@app.route('/api/feedback', methods=['POST'])
def api_submit_feedback():
    data = request.get_json()
    if not data or 'queueId' not in data or 'rating' not in data:
        return jsonify(error='Missing data'), 400

    queue = Queue.query.get(data['queueId'])
    if not queue:
        return jsonify(error='Queue not found'), 404

    sentiment_score = 0.0
    if data.get('comment'):
        analysis = TextBlob(data['comment'])
        sentiment_score = analysis.sentiment.polarity # Score between -1 and 1

    feedback = Feedback(
        rating=data['rating'],
        comment=data.get('comment'),
        sentiment=sentiment_score,
        queue_id=queue.id
    )
    db.session.add(feedback)
    db.session.commit()

    send_email(
        'Service Feedback Received',
        recipients=app.config['ADMINS'],
        text_body=f"Feedback received for queue {queue.queue_number}.\nRating: {feedback.rating}\nComment: {feedback.comment}",
        html_body=f"<p>Feedback received for queue {queue.queue_number}.</p><p>Rating: {feedback.rating}</p><p>Comment: {feedback.comment}</p>"
    )

    return jsonify(success=True, message='Thank you for your feedback!')

# --- SocketIO Handlers ---
@socketio.on('staff_action')
@login_required
def on_staff_action(data):
    # ... logic from previous step ...
    # if action == 'complete_service':
    #     send_email(...)
    pass

if __name__ == '__main__':
    socketio.run(app)
