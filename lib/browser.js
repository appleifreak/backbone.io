(function() {
    var Backbone, _;

    if (typeof require === "function") {
        Backbone = require("backbone");
        _ = require("underscore");
    } else {
        Backbone = window.Backbone;
        _ = window._;
    }

    function Promise(context) {
        this.context = context || this;
        this.callbacks = [];
        this.resolved = undefined;
    };

    Promise.prototype.then = function(callback) {
        if (this.resolved !== undefined) {
            callback.apply(this.context, this.resolved);
        } else {
            this.callbacks.push(callback);
        }
    };

    Promise.prototype.resolve = function() {
        if (this.resolved) throw new Error('Promise already resolved');

        var self = this;
        this.resolved = arguments;

        _.each(this.callbacks, function(callback) {
            callback.apply(self.context, self.resolved);
        });
    };

    var connected = new Promise(),
        socket_ready = new Promise(),
        global_options = null;

    connected.then(function(socket) {
        socket.emit('listen', null, function(options) {
            socket.on('synced', function(method, resp) {
                console.log(arguments);
                var event = options.event;

                collection.trigger(event, method, resp);
                collection.trigger(event + ':' + method, resp);
            });

            socket_ready.resolve(socket, options);
        });
    });

    Backbone.io = Backbone.IO = {
        connect: function() {
            var socket = io.connect.apply(io, arguments);
            connected.resolve(socket);
            return socket;
        }
    };
    
    var origSync = Backbone.sync;

    function makeError(err) {
        var e = new Error(err.message);
        e.name = err.name;
        return e;
    }

    Backbone.sync = function(method, model, options) {
        var backend = model.backend || (model.collection && model.collection.backend);
        
        options = _.clone(options);

        var error = options.error || function() {};
        var success = options.success || function() {};
        
        if (backend) {
            // Don't pass the callbacks to the backend
            delete options.error;
            delete options.success;
            // don't pass the collection either (added by collection create)
            delete options.collection; 
            
            // Use Socket.IO backend
            backend.ready(function() {
                var req = {
                    method: method,
                    model: model.toJSON(),
                    options: options
                };
                
                console.log(req);
                backend.socket.emit('sync', req, function(err, resp) {
                    if (err) error(makeError(err));
                    else success(resp);
                });
            });
        } else {
            // Call the original Backbone.sync
            return origSync(method, model, options);
        }
    };

    var Mixins = {
        // Listen for backend notifications and update the
        // collection models accordingly.
        bindBackend: function() {
            var self = this;
            var idAttribute = this.model.prototype.idAttribute;
            
            this.backend.ready(function() {
                var event = self.backend.options.event;
                
                self.bind(event + ':create', function(model) {
                    self.add(model);
                });
                self.bind(event + ':update', function(model) {
                    var item = self.get(model[idAttribute]);
                    if (item) item.set(model);
                });
                self.bind(event + ':delete', function(model) {
                    self.remove(model[idAttribute]);
                });
            });
        }  
    };
    
    Backbone.Collection = (function(Parent) {
        // Override the parent constructor
        var Child = function() {
            if (this.backend) {
                this.backend = buildBackend(this);
            }
            
            Parent.apply(this, arguments);
        };
        
        // Inherit everything else from the parent
        return inherits(Parent, Child, [Mixins]);
    })(Backbone.Collection);

    // Helpers
    // ---------------

    function inherits(Parent, Child, mixins) {
        var Func = function() {};
        Func.prototype = Parent.prototype;

        mixins || (mixins = [])
        _.each(mixins, function(mixin) {
            _.extend(Func.prototype, mixin);
        });

        Child.prototype = new Func();
        Child.prototype.constructor = Child;

        return _.extend(Child, Parent);
    };
    
    function buildBackend(collection) {
        var ready = new Promise();
        var options = collection.backend;
        
        if (typeof options === 'string') {
            var name = options;
            var channel = undefined;
        } else {
            var name = options.name;
            var channel = options.channel;
        }

        var backend = {
            name: name,
            channel: channel,
            ready: function(callback) {
                ready.then(callback);
            }
        };

        socket_ready.then(function(socket, options) {
            backend.socket = socket;
            backend.options = options;
            ready.resolve();
        });

        return backend;
    };

})();
