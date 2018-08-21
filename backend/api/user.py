import json
import uuid
import flask
import authomatic
from authomatic.providers import oauth2
from authomatic.extras.flask import FlaskAuthomatic

from google.appengine.ext import ndb  # pylint: disable=E0401,E0611

from common import validation
from storage.user import User


APP = flask.Blueprint("user", __name__)
SESSION = flask.session

KEYS = json.load(open("keys.json"))

SECRET_KEY = KEYS["secret_key"]

CONFIG = {
    "google": {
        "class_": oauth2.Google,
        "consumer_key": KEYS["google"]["client_id"],
        "consumer_secret": KEYS["google"]["client_secret"],
        "scope": ["profile", "email"],
        "id": authomatic.provider_id()
    }
}

FA = FlaskAuthomatic(config=CONFIG, secret=SECRET_KEY, session_max_age=6e6)

@APP.route("/auth/google", methods=["GET", "POST"])
@FA.login("google")
def authenticate():
    data = flask.request.get_json()
    redirect_url = data.get("redirectUrl", "/#/editor") if data else "/#/editor"
    if FA.result:
        if FA.result.error:
            return flask.redirect("/#/login")

        if FA.result.user:
            FA.result.user.update()

            if not FA.result.user.id:
                flask.abort(404)

            user = User.query(User.googleId == FA.result.user.id).get()
            if not user:
                if FA.result.user.email:
                    user = User.query(User.email == FA.result.user.email).get()
                if not user:
                    user = User()
                    user.name = FA.result.user.name
                    user.email = FA.result.user.email
                    user.imageUrl = FA.result.user.picture
                    user.authKey = str(uuid.uuid4())

                user.googleId = FA.result.user.id
                user.put()

            SESSION["uid"] = user.key.id()
            SESSION["credentials"] = FA.result.user.credentials.serialize()

            return flask.redirect(redirect_url)

    return FA.response


@APP.route("/logout")
def logout():
    SESSION.pop("uid", None)
    SESSION.pop("credentials", None)
    return flask.redirect("/")


def get_uid():
    uid = SESSION.get("uid", None)
    serialized_credentials = SESSION.get("credentials", None)

    if uid and serialized_credentials:
        credentials = FA.credentials(serialized_credentials)
        if credentials.valid:
            return uid

    headers = flask.request.headers
    if headers:
        uid = headers.get(u"uid", None)
        auth_key = headers.get(u"authKey", None)
        if uid and auth_key:
            uid = int(uid)
            user = ndb.Key(User, uid).get()
            if user.authKey == auth_key:
                return uid

    return None


def get_user():
    uid = get_uid()
    if uid:
        return ndb.Key(User, uid).get()
    return None


@APP.route("/whoami", methods=["GET", "POST"])
def whoami():
    user = get_user()
    if user:
        response = {
            "uid": user.key.id(),
            "name": user.name,
            "email": user.email,
            "subscribed": user.subscribed,
            "authKey": user.authKey
        }
    else:
        response = {}
    return flask.jsonify(response)


@APP.route("/generate_key", methods=["POST"])
def generate_key():
    user = get_user()
    if not user:
        flask.abort(404)

    user.authKey = str(uuid.uuid4())
    user.put()

    return "Success.", 200


@APP.route("/update", methods=["POST"])
def update():
    user = get_user()
    if not user:
        flask.abort(404)
    data = flask.request.get_json()
    name = data[u"name"]
    subscribed = bool(data[u"subscribed"])
    if not validation.valid_name(name):
        flask.abort(400)

    user.name = name
    user.subscribed = subscribed
    user.put()

    return "Success.", 200
