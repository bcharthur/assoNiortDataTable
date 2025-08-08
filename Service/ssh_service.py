# Service/ssh_service.py (vérifiez que c’est bien implémenté)
from paramiko import SSHClient, AutoAddPolicy, Ed25519Key

class SSHService:
    @staticmethod
    def test_connection(server):
        client = SSHClient()
        client.set_missing_host_key_policy(AutoAddPolicy())
        key = Ed25519Key.from_private_key_file(server.key_path)
        client.connect(
            hostname=server.host,
            port=server.port,
            username=server.user,
            pkey=key,
            timeout=10
        )
        client.close()
        return True, "Connexion réussie."
