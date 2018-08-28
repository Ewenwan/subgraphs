const {ds, fromDatastore} = require('./datastore');

const documentKind = 'Document';

function getKey(id) {
  return ds.key([documentKind, parseInt(id, 10)]);
}

function read({identifier, category, owner, public}) {
  const q = ds.createQuery(documentKind);

  if (identifier)
    q.filter('identifier', '=', identifier);

  if (category)
    q.filter('category', '=', category);

  if (owner)
    q.filter('owner', '=', owner);

  if (public)
    q.filter('public', '=', public);

  return ds.runQuery(q).then(results => fromDatastore(results[0]));
}

function update({title, identifier, category, owner, public, content}) {
  return read({identifier, owner}).then(docs => {
    let key, date;
    if (docs.length > 0) {
      let doc = docs[0];
      key = doc.key;
      date = doc.date;
    } else {
      key = ds.key(documentKind);
      date = new Date();
    }

    const entity = {
      key: key,
      excludeFromIndexes: ['content'],
      data: {title, identifier, category, owner, public, content, date},
    };

    return ds.upsert(entity);
  });
}

function remove(key) {
  ds.delete(key);
}

function findAndRemove({identifier, owner}) {
  return read({identifier, owner}).then(docs => {
    if (docs.length > 0) {
      remove(docs[0].key);
    }
  });
}

module.exports = {
  kind: documentKind,
  key: getKey,
  read,
  update,
  remove,
  findAndRemove
};