import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, current_user, login_user, logout_user, login_required
from flask_socketio import SocketIO, emit
from werkzeug.security import generate_password_hash, check_password_hash
from textblob import TextBlob
from datetime import datetime, time, date
from functools import wraps
import click

from config import Config

# --- App Initialization ---
app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login = LoginManager(app)
login.login_view = 'api_login'
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Decorators ---
def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if current_user.role != 'admin':
            return jsonify(error='Admin access required'), 403
        return f(*args, **kwargs)
    return decorated_function

# --- Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))
    full_name = db.Column(db.String(120))
    role = db.Column(db.String(20), index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branch.id'))
    status = db.Column(db.String(20), default='active')
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)
    def to_dict(self): return {'id': self.id, 'username': self.username, 'email': self.email, 'full_name': self.full_name, 'role': self.role, 'branch_id': self.branch_id, 'status': self.status}

@login.user_loader
def load_user(id): return User.query.get(int(id))

class Branch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), index=True, unique=True)
    address = db.Column(db.String(255))
    contact = db.Column(db.String(50))
    status = db.Column(db.String(20), default='active')
    users = db.relationship('User', backref='branch', lazy='dynamic')
    def to_dict(self): return {'id': self.id, 'name': self.name, 'address': self.address, 'contact': self.contact, 'status': self.status}

class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), index=True, unique=True)
    description = db.Column(db.String(255))
    icon = db.Column(db.String(50))
    color = db.Column(db.String(20))
    status = db.Column(db.String(20), default='active')
    sub_services = db.relationship('SubService', backref='service', lazy='dynamic', cascade="all, delete-orphan")
    def to_dict(self): return {'id': self.id, 'name': self.name, 'description': self.description, 'icon': self.icon, 'color': self.color, 'status': self.status, 'sub_services': [ss.to_dict() for ss in self.sub_services]}

class SubService(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), index=True)
    description = db.Column(db.String(255))
    icon = db.Column(db.String(50))
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'), nullable=False)
    def to_dict(self): return {'id': self.id, 'name': self.name, 'description': self.description, 'icon': self.icon}

class Queue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    queue_number = db.Column(db.String(20), index=True)
    student_name = db.Column(db.String(120))
    status = db.Column(db.String(20), index=True, default='waiting')
    created_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'))
    sub_service_id = db.Column(db.Integer, db.ForeignKey('sub_service.id'))
    def to_dict(self): return {'id': self.id, 'number': self.queue_number, 'student_name': self.student_name, 'status': self.status, 'created_at': self.created_at.isoformat(), 'service': self.service.name.lower(), 'sub_service': self.sub_service.name}

# --- Main Route ---
@app.route('/')
def index(): return render_template('index.html')

# --- Helper to get full state ---
def get_full_dashboard_data():
    return {
        'queues': [q.to_dict() for q in Queue.query.filter(db.func.date(Queue.created_at) == date.today()).all()],
        'services': [s.to_dict() for s in Service.query.all()],
        'branches': [b.to_dict() for b in Branch.query.all()],
        'users': [u.to_dict() for u in User.query.all()],
    }

# --- SocketIO Handlers ---
@socketio.on('connect')
def on_connect(): emit('update_data', get_full_dashboard_data())

# --- General APIs ---
@app.route('/api/status')
def api_status():
    if current_user.is_authenticated: return jsonify(logged_in=True, user=current_user.to_dict())
    return jsonify(logged_in=False)

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user is None or not user.check_password(data.get('password')): return jsonify(error='Invalid credentials'), 401
    login_user(user, remember=True)
    return jsonify(user.to_dict())

@app.route('/api/logout', methods=['POST'])
def api_logout():
    logout_user()
    return jsonify(success=True)

# --- Admin CRUD APIs ---
@app.route('/api/admin/services', methods=['POST'])
@admin_required
def create_service():
    data = request.get_json()
    service = Service(name=data['name'], description=data.get('description'), icon=data.get('icon'), color=data.get('color'))
    db.session.add(service)
    db.session.commit()
    socketio.emit('update_data', get_full_dashboard_data(), broadcast=True)
    return jsonify(service.to_dict()), 201

@app.route('/api/admin/services/<int:id>', methods=['PUT', 'DELETE'])
@admin_required
def handle_service(id):
    service = Service.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json()
        service.name = data.get('name', service.name)
        service.description = data.get('description', service.description)
        service.icon = data.get('icon', service.icon)
        service.color = data.get('color', service.color)
        service.status = data.get('status', service.status)
    elif request.method == 'DELETE':
        db.session.delete(service)
    db.session.commit()
    socketio.emit('update_data', get_full_dashboard_data(), broadcast=True)
    return jsonify(success=True)

@app.route('/api/admin/sub_services', methods=['POST'])
@admin_required
def create_sub_service():
    data = request.get_json()
    sub_service = SubService(name=data['name'], description=data.get('description'), icon=data.get('icon'), service_id=data['service_id'])
    db.session.add(sub_service)
    db.session.commit()
    socketio.emit('update_data', get_full_dashboard_data(), broadcast=True)
    return jsonify(sub_service.to_dict()), 201

@app.route('/api/admin/sub_services/<int:id>', methods=['PUT', 'DELETE'])
@admin_required
def handle_sub_service(id):
    sub_service = SubService.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json()
        sub_service.name = data.get('name', sub_service.name)
        sub_service.description = data.get('description', sub_service.description)
        sub_service.icon = data.get('icon', sub_service.icon)
    elif request.method == 'DELETE':
        db.session.delete(sub_service)
    db.session.commit()
    socketio.emit('update_data', get_full_dashboard_data(), broadcast=True)
    return jsonify(success=True)


if __name__ == '__main__':
    socketio.run(app, debug=True)
