(function($) {

  $.TableOfContents = function(options) {

    jQuery.extend(true, this, {
      element:           null,
      appendTo:          null,
      windowId:          null,
      manifest:          null,
      manifestVersion:   null,
      selectContext:    null,
      active: null,
      eventEmitter: null
    }, options);

    this.init();

    var self = this;
    window.render = function() {self.render();};
  };

  $.TableOfContents.prototype = {
    init: function () {
      var _this = this;
      this.structures = this.manifest.getStructures(),
      this.manifestVersion = this.manifest.getVersion(),
      this.initTreeData();
      this.element = jQuery('<div class="toc"></div>').appendTo(this.appendTo);
      this.initTree();      
      this.bindEvents();
    },

    tabStateUpdated: function(data) {
      if (data.tabs[data.selectedTabIndex].options.id === 'tocTab') {
        this.element.show();
      } else {
        this.element.hide();
      }
    },
    
    initTreeData: function() {
      var filteredStructures = this.structures.map(function(structure) {
            structure.id = structure['@id'];
            return structure;
          });
      var _this = this;
      
      function elementId(id) {
        id.replace(/[^a-zA-Z0-9]/g,'_');
      }
          
      function buildTreeData(item) {
        if (typeof(item) === 'string'){
          var label = _this.manifest.getCanvases().find(function(canvas){return canvas['@id']===item;}).label;
          return {
            'text': label,
            'id': elementId(item),
            'icon' : 'canvas fa fa-certificate star',
            'children': [],
            'data': {'type':'canvas', 'original':item, 'uri': item},
            'a_attr': {'class':'toc-link'}
          };
        }
        else {
          children = (item.children || []);
//          children = children.concat(item.canvases || []);
          return {
            'text': item.label,
            'id': elementId(item['@id']),
            'icon': 'range fa ' + (children.length ? 'fa-caret-right toc-caret has-children' : 'fa-certificate star'),
            'children': children.map(buildTreeData),
            'data': {'type':'range', 'original':item, 'uri': item['@id']},
            'a_attr': {'class':'toc-link'}
          };
        }
      }
      
      function unflatten(ranges, parent) {
        parent = typeof(parent) !== 'undefined' ? parent : {'@id': "root", label: "Table of Contents", level: 0 };
        var children = ranges.filter(function(child) { return (child.within || 'root') == parent['@id']; });
        children.forEach(function(child) {
          child.level = parent.level+1;
        });
        parent.children = children;
        children.forEach(function(child){ unflatten(ranges, child); });
        return parent;
      }
      
      var root = unflatten(this.structures);
      this.treeData = buildTreeData(root).children;
      if (this.treeData.length === 1 && this.treeData[0].children.length > 1) {
        this.treeData = this.treeData[0].children;
      }
    },
    
    initTree: function() {
      this.element.jstree({
        'core': {
          'data': this.treeData,
          'check_callback': true //function(operation, node, parent, position, more){ return true; }
        },
//        'plugins' : ['dnd','contextmenu']
      });
    },

    bindEvents: function() {
      var _this = this;

      // _this.eventEmitter.subscribe('focusChanged', function(_, focusFrame) {
      // });

      // _this.eventEmitter.subscribe('cursorFrameUpdated', function(_, cursorBounds) {
      // });

      _this.eventEmitter.subscribe('tabStateUpdated.' + _this.windowId, function(_, data) {
        _this.tabStateUpdated(data);
      });

      _this.eventEmitter.subscribe(('currentCanvasIDUpdated.' + _this.windowId), function(event, canvasID) {
        if (!_this.structures) { return; }
        _this.setSelectedElements($.getRangeIDByCanvasID(_this.structures, canvasID));
      });

      _this.element.on('activate_node.jstree', function(event, data){
        var node = data.node;
        if (node.data.type === 'range') {
          var canvasID = node.data.original.canvases[0]; // TODO: don't use original, won't work after modifying tree
          _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + _this.windowId, canvasID);
        }
      });

    },

    setActive: function(active) {
      var _this = this;
      _this.active = active;
    },

    setSelectedElements: function(rangeIDs) {
      var _this = this;
      var tree = this.element.jstree(true);
      
      function handleElement() {
        var node = tree.get_node(this);
        var li=jQuery(this);
        if (rangeIDs.includes(node.data.uri)) {
          li.addClass('selected');
          if (tree.is_closed(node)){
            tree.open_node(node);
            li.find('li.jstree-node').each(handleElement);
          }
        }
        else {
          li.removeClass('selected');
          tree.close_node(node);
        }        
      }
      
      this.element.find('li.jstree-node').each(handleElement);
      
      var head = this.element.find('.selected').first();
      if (head.length > 0) {
        this.element.scrollTo(head, 400);
      }
    },

    hide: function() {
      var _this = this;
      jQuery(this.appendTo).hide();
      _this.eventEmitter.publish('ADD_CLASS.'+this.windowId, 'focus-max-width');
    },

    show: function() {
      var _this = this;
      jQuery(this.appendTo).show({effect: "fade", duration: 300, easing: "easeInCubic"});
      _this.eventEmitter.publish('REMOVE_CLASS.'+this.windowId, 'focus-max-width');
    }

  };

}(Mirador));
