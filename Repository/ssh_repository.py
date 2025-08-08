# app/repositories/ssh_repository.py
from Entity.ssh_server import SSHServer
from app import db

class SSHRepository:
    @staticmethod
    def get_all():
        return SSHServer.query.all()

    @staticmethod
    def get_by_id(server_id: int):
        return SSHServer.query.get(server_id)

    @staticmethod
    def add(server: SSHServer):
        db.session.add(server)
        db.session.commit()
