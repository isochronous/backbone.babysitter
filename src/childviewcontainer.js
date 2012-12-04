// Backbone.ChildViewContainer
// ---------------------------
//
// Provide a container to store, retrieve and
// shut down child views.
Backbone.ChildViewContainer = (function(Backbone, _) {

    var console = window.console;

    // Container Constructor
    // ---------------------
    /**
     * A Backbone.BabySitter ChildViewContainer with a couple of additional options.
     * @param {Array<Backbone.View|Object>} initialViews  - An array of views, or an array of objects with properties that
     *    can be used to instantiate views.  If it is an object array, a `parse` method must be supplied in the options
     *    hash.
     * @param {Object} [options] - An options hash to set specific properties on this `ChildViewContainer`. Each option
     *  property corresponds to a possible property on the object, with the `options` version taking precedence.
     *     @param {Function} [options.parser] - A function to call on each view/configuration object before it is added to
     *      the container.  If the `view` parameter passed to `add` is not an instance of Backbone.View or a subclass of
     *      Backbone.View, then a `parser` method is required on the container (or one must be provided in the options
     *      hash). **Must return a view instance**
     *     @param {Function} [options.initialize] - A function that will be automatically called by the constructor after
     *      the container has been set up and any `initialViews` have been added to the container.  Again, may be defined
     *      by extending this class, or by providing an `initialize` property in the options hash.
     *     @param {String} [options.customIndexProperty=customIndex] - A property name that should be present on any views
     *      added to the container, the value of which should be used as that view's custom index.  For example, if you
     *      had a `viewIndex` parameter on all of your views, you could pass "viewIndex" as the
     *      options.customIndexProperty. Then when `add()` is called on this container, if no customIndex is specified,
     *      the view will be examined for the value of its `viewIndex` property, and if found, will be set as its
     *      customIndex.
     */
    var Container = function(initialViews, options) {
            this.options = options || (options = {});
            this._views = {};
            this._indexByModel = {};
            this._indexByCollection = {};
            this._indexByCustom = {};
            this._updateLength();

            this.parser = options.parser || this.parser || false;
            this.parser = (_.isFunction(this.parser)) ? this.parser : false;
            this.customIndexProperty = options.customIndexProperty || this.customIndexProperty;

            this._addInitialViews(initialViews);

            var init = options.initialize || this.initialize || false;
            if(init) { init.call(this, options); }
        };

    // Container Methods
    // -----------------
    _.extend(Container.prototype, {

        customIndexProperty: "customIndex",

        // Add a view to this container. Stores the view
        // by `cid` and makes it searchable by the model
        // and/or collection of the view. Optionally specify
        // a custom key to store an retrieve the view.
        add: function(view, customIndex) {
            var vta = (this.parser) ? this.parser(view) : view;
            if (!vta) {
                console.error("Couldn't add view %o: unexpected format", view);
                return;
            }
            if (!(vta instanceof Backbone.View)) {
                console.error("Cannot add non-view object to container: ", view);
                return;
            }
            view = vta;
            var viewCid = view.cid;
            var customIndexProperty = this.customIndexProperty;

            customIndex = customIndex || view[customIndexProperty] || false;

            // store the view
            this._views[viewCid] = view;

            // index it by model
            if(view.model) {
                this._indexByModel[view.model.cid] = viewCid;
            }

            // index it by collection
            if(view.collection) {
                this._indexByCollection[view.collection.cid] = viewCid;
            }

            // index by custom
            if(customIndex) {
                this._indexByCustom[customIndex] = viewCid;
            }

            this._updateLength();
        },

        // Find a view by the model that was attached to
        // it. Uses the model's `cid` to find it, and
        // retrieves the view by it's `cid` from the result
        findByModel: function(model) {
            var viewCid = this._indexByModel[model.cid];
            return this.findByCid(viewCid);
        },

        // Find a view by the collection that was attached to
        // it. Uses the collection's `cid` to find it, and
        // retrieves the view by it's `cid` from the result
        findByCollection: function(col) {
            var viewCid = this._indexByCollection[col.cid];
            return this.findByCid(viewCid);
        },

        // Find a view by a custom indexer.
        findByCustom: function(index) {
            var viewCid = this._indexByCustom[index];
            return this.findByCid(viewCid);
        },

        // Find by index. This is not guaranteed to be a
        // stable index.
        findByIndex: function(index) {
            return _.values(this._views)[index];
        },

        // retrieve a view by it's `cid` directly
        findByCid: function(cid) {
            return this._views[cid];
        },

        // Remove a view
        remove: function(view) {
            var viewCid = view.cid;

            // delete model index
            if(view.model) {
                delete this._indexByModel[view.model.cid];
            }

            // delete collection index
            if(view.collection) {
                delete this._indexByCollection[view.collection.cid];
            }

            // delete custom index
            var cust;

            for(var key in this._indexByCustom) {
                if(this._indexByCustom.hasOwnProperty(key)) {
                    if(this._indexByCustom[key] === viewCid) {
                        cust = key;
                        break;
                    }
                }
            }

            if(cust) {
                delete this._indexByCustom[cust];
            }

            // remove the view from the container
            delete this._views[viewCid];

            // update the length
            this._updateLength();
        },

        // Call a method on every view in the container,
        // passing parameters to the call method one at a
        // time, like `function.call`.
        call: function(method, args) {
            args = Array.prototype.slice.call(arguments, 1);
            this.apply(method, args);
        },

        // Apply a method on every view in the container,
        // passing parameters to the call method one at a
        // time, like `function.apply`.
        apply: function(method, args) {
            var view;

            // fix for IE < 9
            args = args || [];

            _.each(this._views, function(view, key) {
                if(_.isFunction(view[method])) {
                    view[method].apply(view, args);
                }
            });

        },

        // Update the `.length` attribute on this container
        _updateLength: function() {
            this.length = _.size(this._views);
        },

        // set up an initial list of views
        _addInitialViews: function(views) {
            if(!views) {
                return;
            }

            var view, i,
                length = views.length;

            for(i = 0; i < length; i++) {
                view = views[i];
                this.add(view);
            }
        }
    });

    // Borrowing this code from Backbone.Collection:
    // http://backbonejs.org/docs/backbone.html#section-106
    //
    // Mix in methods from Underscore, for iteration, and other
    // collection related features.
    var methods = ['forEach', 'each', 'map', 'find', 'detect', 'filter',
            'select', 'reject', 'every', 'all', 'some', 'any', 'include',
            'contains', 'invoke', 'toArray', 'first', 'initial', 'rest',
            'last', 'without', 'isEmpty', 'pluck'];

    _.each(methods, function(method) {
        Container.prototype[method] = function() {
            var views = _.values(this._views);
            var args = [views].concat(_.toArray(arguments));
            return _[method].apply(_, args);
        };
    });

    // return the public API
    return Container;
})(Backbone, _);