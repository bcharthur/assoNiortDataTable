import docker

from Repository.docker_repository import SSH_USER, SSH_HOST

client = docker.DockerClient(base_url=f"ssh://{SSH_USER}@{SSH_HOST}")

for container in client.containers.list(all=True):  # all=True pour tous les conteneurs, même stoppés
    print(container.name)
