from flask import Flask
from Controller.association_controller import bp as home_bp

def create_app():
    app = Flask(__name__)
    app.register_blueprint(home_bp)
    return app

if __name__ == "__main__":
    create_app().run(debug=True)
