Backbone.IO
===========

Storage-agnostic Backbone.js sync override and server notifications via Socket.IO.

Install
-------

    npm install backbone.io
    
Usage
-----

On the server:

    var http        = require('http'),
        backboneio  = require('backbone.io'),
        app         = http.createServer();
        
    app.listen(3000);

    var Backend = require('backbone.io/backends/memory');
    backboneio.listen(app, { mybackend: new Backend() });

On the client:

    <!-- Include Underscore, Backbone -->
    
    <script src="/socket.io/socket.io.js"></script>
    <script src="/socket.io/backbone.io.js"></script>
    
    <script>
        var MyCollection = Backbone.Collection.extend({
            backend: 'mybackend'
        });
    </script>
    
Models in `TestCollection` will now be synced to `mybackend`.

Events
------

When a model is synced with a particular backend, the backend will trigger events
on collections (across multiple clients) that share the backend.  For example, we
could keep collections synced in realtime with the following event bindings:

    var MyCollection = Backbone.Collection.extend({
        
        backend: 'mybackend',
        
        initialize: function() {
            var self = this;
        
            this.bind('backend:create', function(model) {
                self.add(model);
            });
            this.bind('backend:update', function(model) {
                self.get(model.id).set(model);
            });
            this.bind('backend:delete', function(model) {
                self.remove(model.id);
            });
        }
        
    });
    
Or use the provided shortcut:
    
    backend: 'mybackend',
    
    initialize: function() {
        this.bindBackend();
    }
    
In addition to `backend:create`, `backend:read`, `backend:update`, and `backend:delete`
events, a generic `backend` event is also triggered when a model is synced.

    this.bind('backend', function(method, model) {
        // Method will be one of create, read, update, or delete
    });
    
The event prefix `backend` is used by default but this can be customized by setting the
event name on the server.

    backboneio.listen(app, { mybackend: new Backend() }, { event: 'myevent' });

Backends
--------

A backend is an object that exposes four functions, `create`, `read`, `update`, and `delete`,
corresponding to the methods of `Backbone.sync`.  Each function takes a model object and a
callback.  For example, a backend that interacts with a database might look something like this:

    var MyBackend = {
        create: function(model, callback) {
            db.insert(model, function(err, record) {
                // The returned record must have an `id`
                // attribute defined.
                callback(err, record);
            });
        },
        
        read: function(model, callback) {
            if (model.id) {
                // When an `id` is present, return single record
                db.findOne({ id: model.id }, function(err, record) {
                    callback(err, record);
                });
            } else {
                // Otherwise return all records
                db.find({}, function(err, records) {
                    callback(err, records);
                });
            }
        },
        
        update: function(model, callback) {
            db.update({ id: model.id }, model, function(err) {
                // Return the updated model
                callback(err, model);
            });
        },
        
        delete: function(model, callback) {
            db.delete({ id: model.id }, function(err) {
                // Return the deleted model
                callback(err, model);
            });
        }
    };
    
One can then use the custom backend like so:

    backboneio.listen(app, { mybackend: MyBackend });
    
Further Customizations
----------------------

Since the call to `listen` returns the Socket.IO object, it can be manipulated beyond the
basics of Backbone.IO.  Take a look at `examples/auth.js`, for example, to see how this can
be leveraged to implement a custom authorization scheme.