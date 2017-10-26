import json
import flask
from google.appengine.ext import ndb  # pylint: disable=E0401,E0611
from api import user
from storage.document import Document
from storage.user import User

APP = flask.Blueprint("doc", __name__)


@APP.route("/list", methods=["POST"])
def list_docs():
    expression = Document.public == True
    data = flask.request.get_json()
    uid = int(data.get(u"uid", user.get_uid()))
    if uid:
        expression = ndb.OR(
            Document.owner == ndb.Key(User, uid),
            expression)
    category = data.get(u"category")
    if category:
        expression = ndb.AND(
            Document.category == category,
            expression)
    query = Document.query(expression)
    docs = query.fetch()
    docs = [json.loads(doc.content) for doc in docs]
    return flask.jsonify(docs)


@APP.route("/get", methods=["POST"])
def get_doc():
    data = flask.request.get_json()
    uid = int(data.get(u"uid", user.get_uid()))
    if not uid:
        flask.abort(403)

    identifier = data.get(u"identifier")
    if not identifier:
        flask.abort(400)

    expression = ndb.AND(
        Document.identifier == identifier,
        ndb.OR(
            Document.owner == ndb.Key(User, uid),
            Document.public == True))

    doc = Document.query(expression).get()
    return flask.jsonify(json.loads(doc.content))


@APP.route("/save", methods=["POST"])
def save_doc():
    data = flask.request.get_json()
    uid = int(data.get(u"uid", user.get_uid()))
    if not uid:
        flask.abort(403)

    user_key = ndb.Key(User, uid)
    if data[u"public"] and not user_key.get().isAdmin:
        flask.abort(403)

    identifier = data.get(u"identifier")
    if not identifier:
        flask.abort(400)

    doc = Document.query(
        ndb.AND(Document.identifier == identifier,
                Document.owner == user_key)).get()

    if not doc:
        doc = Document()
        doc.owner = user_key

    doc.title = data[u"title"]
    doc.identifier = data[u"identifier"]
    doc.category = data[u"category"]
    doc.public = data[u"public"]
    doc.content = json.dumps(data)
    doc.put()
    return "Success.", 200


@APP.route("/delete", methods=["POST"])
def delete_doc():
    data = flask.request.get_json()
    uid = int(data.get(u"uid", user.get_uid()))
    if not uid:
        flask.abort(403)

    identifier = data.get(u"identifier")
    if not identifier:
        flask.abort(400)

    doc = Document.query(
        ndb.AND(Document.identifier == identifier,
                Document.owner == ndb.Key(User, uid))).get()
    if not doc:
        flask.abort(400)

    if doc.owner.id() != uid:
        flask.abort(401)

    doc.key.delete()
    return "Success.", 200
