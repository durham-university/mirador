(function($) {

  $.TableOfContents = function(options) {

    jQuery.extend(true, this, {
      element:           null,
      appendTo:          null,
      windowId:          null,
      manifest:          null,
      manifestVersion:   null,
      selectContext:     null,
      active:            null,
      eventEmitter:      null,
      editMode:          null,
      endpointConfig:    null,
      editable:          null,
      omitRootNode:      true,
      autoCreateRootNode: 'Table of contents'
    }, options);

    this.init();

    var self = this;
    window.render = function() {self.render();};
  };

  $.TableOfContents.prototype = {
    init: function () {
      var _this = this;
      this.manifestVersion = this.manifest.getVersion(),
      this.element = jQuery('<div class="toc"></div>').appendTo(this.appendTo);
      this.editMode = false;
      
      if (typeof(this.editable) !== 'boolean') {
        this.editable = !!this.endpointConfig;
      }
      
      if (this.editable) {
        jQuery([
          '<div class="toc-tools">',
            '<div class="tool-icon edit-icon fa fa-lg fa-edit"></div>',
            '<span class="toc-edit-tools">',
              '<div class="tool-icon save-icon fa fa-lg fa-save"></div>',
              '<div class="tool-icon undo-icon fa fa-lg fa-undo"></div>',
              '<div class="tool-icon add-icon fa fa-lg fa-plus"></div>',
            '</span>',
          '</div>'
        ].join('')).appendTo(this.element);
      }
      this.treeElement = jQuery('<div class="toc-tree"></div>').appendTo(this.element);
      
      this.initStructures();
      this.resetTree();
      this.bindEvents();
    },
    
    initStructures: function() {
      function unflatten(ranges, parent) {
        parent = typeof(parent) !== 'undefined' ? parent : {
          '@id': "root", 
          'label': "JSTree root", 
          'parent': null,
          'ranges': ranges.filter(function(range) { return range.viewingHint=='top'; }).map(function(range){ return range['@id']; })
        };
        var children;
        if (parent.ranges) children = ranges.filter(function(child) { return parent.ranges.indexOf(child['@id'])>=0; });
        else children = ranges.filter(function(child) { return (child.within || 'root') == parent['@id']; });
        parent.children = children;
        children.forEach(function(child){ 
          child.parent = parent;
          unflatten(ranges, child); 
        });
        return parent;
      }
      this.structures = unflatten(this.manifest.getStructures());      
    },
    
    revert: function() {
      this.initStructures();
    },
    
    saveStructures: function() {
      this.getEndpoint().saveStructures(this);
    },
    
    getEndpoint: function() {
      if (!this.endpointConfig) return null;
      if (!this.endpoint) this.endpoint = new $[this.endpointConfig.module](this.endpointConfig.options);
      return this.endpoint;
    },
    
    sortCanvases: function(array) {
      var canvasOrder = this.manifest.getCanvases().map(function(canvas){return canvas['@id'];});
      var canvasSorter = function(a,b){
        return canvasOrder.indexOf(a) - canvasOrder.indexOf(b);
      };
      array.sort(canvasSorter);
    },
    
    getStructures: function(format) {
      var _this = this;
      function rangeV1Formatter(range){
        var ret = jQuery.extend({},range);
        delete(ret.parent);
        delete(ret.children);
        delete(ret.ranges);
        if (range.parent['@id'] !== 'root') {
          ret.within = range.parent['@id'];
          delete(ret.viewingHint);
        }
        else {
          delete(ret.within);
          ret.viewingHint = 'top';
        }
        if(ret.canvases) _this.sortCanvases(ret.canvases);
        return ret;
      }
      function rangeV2Formatter(range){
        var ret = jQuery.extend({},range);
        delete ret.parent;
        delete ret.children;
        delete ret.within;
        if (range.parent['@id'] == 'root') ret.viewingHint = 'top';
        else delete(ret.viewingHint);
        ret.ranges = range.children.map(function(r){return r['@id'];});
        if(ret.canvases) _this.sortCanvases(ret.canvases);
        return ret;        
      }
            
      if (typeof(format) === 'function' ) ; // do nothing, it's already a formatter
      else if (format === 1 || format === '1' || format === 'v1' || format === 'V1') format = rangeV1Formatter;
      else if (format === 2 || format === '2' || format === 'v2' || format === 'V2') format = rangeV2Formatter;
      else format = rangeV2Formatter;
      
      var ret=[];
      var stack=[this.rootRange];
      while(stack.length > 0){
        var range = stack.pop();
        if (range['@id'] != 'root') ret.push(format(range));
        for(var i=range.children.length-1;i>=0;i--) stack.push(range.children[i]);
      }
      return ret;
    },
    
    setEditMode: function(enabled) {
      if (this.editMode == enabled) return;
      this.editMode = enabled;
      if (this.editMode) this.element.addClass('editing');
      else this.element.removeClass('editing');
      this.resetTree();
    },
    
    getIIIFRange: function(node_or_uri) {
      if (typeof(node_or_uri) === 'string') {
        if (node_or_uri === '#') return this.rootRange;
        var tree = this.treeElement.jstree(true);
        var node = tree.get_node(node_or_uri);
        if (node) node_or_uri = node;
      }
      if (typeof(node_or_uri) === 'object') {
        if(node_or_uri['@id']) return node_or_uri;
        if(!node_or_uri.data || !node_or_uri.data.uri) return null;
        node_or_uri = node_or_uri.data.uri;
      }
      var stack = [this.rootRange];
      while(stack.length > 0){
        var item = stack.pop();
        if (item['@id'] === node_or_uri) return item;
        if (item.children) stack.push.apply(stack, item.children);
      }
      return null;
    },
    
    // The four remove/add X from/to Y methods modify the IIIF structure
    // in this.structures. JSTree generally takes care of modifying DOM
    // and the intermediate structure between IIIF and DOM.
    removeCanvasFromRange: function(canvas, range) {
      range = this.getIIIFRange(range);
      if (!range || !range.canvases) return;
      if (range.children.find(function(child_range) {
        return child_range.canvases.includes(canvas);
      })) return;
      var ind = range.canvases.indexOf(canvas);
      if (ind>=0) range.canvases.splice(ind,1);
      if (range.parent) this.removeCanvasFromRange(canvas, range.parent);
    },
    
    addCanvasToRange: function(canvas, range) {
      range = this.getIIIFRange(range);
      if (range && range.canvases && !range.canvases.includes(canvas)){
        if (range.canvases.includes(canvas)) return;
        range.canvases.push(canvas);
        this.sortCanvases(range.canvases);
        if (range.parent) this.addCanvasToRange(canvas, range.parent);
      }      
    },
    
    removeRangeFromRange: function(range, parent) {
      range = this.getIIIFRange(range);
      parent = this.getIIIFRange(parent);
      var ind = parent.children.findIndex(function(child){ return child['@id'] == range['@id']; });
      if (ind>=0) parent.children.splice(ind, 1);      
      var _this = this;
      range.canvases.forEach(function(canvas){
        _this.removeCanvasFromRange(canvas, parent);
      });
    },
    
    addRangeToRange: function(range, parent, position) {
      // range has to be an IIIF range. getIIIFRange won't work because the
      // range is not in this.structures until after addRangeToRange is finished.
      parent = this.getIIIFRange(parent);
      if (typeof(position)!=='number') position = parent.children.length;
      parent.children.splice(position, 0, range);
      var _this = this;
      range.canvases.forEach(function(canvas){
        _this.addCanvasToRange(canvas, parent);
      });
    },
        
    resetTree: function() {
      var selected = null;
      var tree = this.treeElement.jstree(true);
      if (tree) {
        selected = jQuery.makeArray(this.treeElement.find('li.selected').map(function(){
          return tree.get_node(this).data.uri;
        }));
        tree.destroy();
      }
      this.initTreeData();
      this.initTree();    
      
      var _this = this;
      this.treeElement.on('activate_node.jstree', function(event, data){
        var node = data.node;
        var canvasID;
        if (node.data.type === 'range') {
          var range = _this.getIIIFRange(node);
          canvasID = range.canvases[0];
          _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + _this.windowId, canvasID);
        }
        else if (node.data.type === 'canvas') {
          canvasID = node.data.uri;
          _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + _this.windowId, canvasID);
        }
      });
      this.treeElement.on('changed.jstree', function(event, data){
      });
      this.treeElement.on('create_node.jstree', function(event, data){
        var parent_range = _this.getIIIFRange(data.parent);
        var node = data.node;
        // Dropping a page on the tree will create a node in the dnd drop
        // handler. All needed node properties are set there. Otherwise
        // the node was created from context menu in which case create
        // a range node.
        if (!node.data || !node.data.type) {
          node.icon = 'range fa fa-certificate star';
          node.data = {'type':'range', 'uri':'jstree:'+node.id};
          node.a_attr.class = 'toc-link';
          node.li_attr.class = 'range';
          var range = {
            '@id': node.data.uri,
            '@type': 'sc:Range',
            'canvases': [],
            'children': [],
            'label': data.node.text,
            'within': parent_range['@id'],
            'parent': parent_range
          };
          parent_range.children.push(range);
        }
        else {
          _this.addCanvasToRange(node.data.uri, parent_range);
        }
      });
      this.treeElement.on('rename_node.jstree', function(event, data){
        var range = _this.getIIIFRange(data.node);
        if (range) range.label = data.text;
      });
      this.treeElement.on('delete_node.jstree', function(event, data){
        if (data.node.data.type === 'canvas') _this.removeCanvasFromRange( data.node.data.uri, data.parent );
        else if (data.node.data.type === 'range') _this.removeRangeFromRange( data.node, data.parent );
      });
      this.treeElement.on('move_node.jstree', function(event, data){
        if (data.node.data.type === 'canvas') {
          _this.removeCanvasFromRange( data.node.data.uri, data.old_parent );
          _this.addCanvasToRange( data.node.data.uri, data.parent );
        }
        else if (data.node.data.type === 'range') {
          var range = _this.getIIIFRange(data.node);
          _this.removeRangeFromRange( range, data.old_parent );
          _this.addRangeToRange( range, data.parent, data.position );
        }
      });
      this.treeElement.on('copy_node.jstree', function(event, data){
        if (data.original.data.type === 'canvas') {
          data.node.data = data.original.data;
          _this.addCanvasToRange( data.node.data.uri, data.parent );
        }
      });
      
      if (selected) {
        this.treeElement.on('loaded.jstree', function(){
          _this.setSelectedElements(selected);          
        });
      }
    },

    tabStateUpdated: function(data) {
      if (data.tabs[data.selectedTabIndex].options.id === 'tocTab') {
        this.element.show();
      } else {
        this.element.hide();
      }
    },
    
    initTreeData: function() {
      var _this = this;
      
      function buildTreeData(item) {
        if (typeof(item) === 'string'){
          var label = _this.manifest.getCanvases().find(function(canvas){return canvas['@id']===item;}).label;
          return {
            'text': label,
            'icon' : 'canvas fa fa-file-text-o star',
            'children': [],
            'data': {'type':'canvas', 'uri': item},
            'a_attr': {'class':'toc-link'},
            'li_attr': {'class':'canvas'}
          };
        }
        else {
          children = (item.children || []);
          if (_this.editMode) {
            children = children.concat((item.canvases || []).filter(function(canvas){
              for(var i=0;i<children.length;i++){
                if(children[i].canvases && children[i].canvases.includes(canvas)) return false;
              }
              return true;
            }));
          }
          return {
            'text': item.label,
//            'icon': 'range fa ' + (children.length ? 'fa-caret-right toc-caret has-children' : 'fa-certificate star'),
            'icon': 'range fa fa-certificate star',
            'children': children.map(buildTreeData),
            'data': {'type':'range', 'uri': item['@id']},
            'a_attr': {'class':'toc-link'},
            'li_attr': {'class':'range'}
          };
        }
      }
      
      this.rootRange = this.structures;
      
      if (this.autoCreateRootNode && this.structures.children.length === 0) {
        var range = {
          '@id': 'jstree:auto_root',
          '@type': 'sc:Range',
          'canvases': [],
          'children': [],
          'label': this.autoCreateRootNode,
          'viewingHint': 'top',
          'parent': this.rootRange
        };
        this.structures.children.push(range);
      }
      
      this.treeData = this.structures.children.map(buildTreeData);
      if (this.omitRootNode && this.treeData.length === 1) {
        this.rootRange = this.rootRange.children[0];
        this.treeData = this.treeData[0].children;
      }
    },
    
    initTree: function() {
      return this.treeElement.jstree({
        'core': {
          'data': this.treeData,
          'check_callback': function(operation, node, parent, position, more){ 
            if (operation === 'move_node'){
              return parent.id === '#' || parent.data.type === 'range';
            }
            else if (operation === 'copy_node') {
              return (parent.id === '#' || parent.data.type === 'range') && node.data.type === 'canvas';              
            }
            else if (operation === 'create_node') {
              return parent.id === '#' || parent.data.type === 'range';
            }
            else return true;
//            console.log("check_callback("+operation+", "+node+", "+parent+", "+position+")");
          }
        },
        'plugins' : (this.editMode ? ['dnd','contextmenu'] : []),
        'contextmenu': {
          'items': function(node, callback) {
            // callback not used, items are returned instead
            var items = jQuery.jstree.defaults.contextmenu.items(node, function(items){} );
            delete(items.ccp);
            var data = node.data;
            if(data.type=='canvas') {
              delete(items.rename);
              delete(items.create);
              if(node.parent=='#') {
                delete(items.remove);
              }
            }
            return items;
          }
        }
      });
    },

    bindEvents: function() {
      var _this = this;

      // _this.eventEmitter.subscribe('focusChanged', function(_, focusFrame) {
      // });

      // _this.eventEmitter.subscribe('cursorFrameUpdated', function(_, cursorBounds) {
      // });
      
      _this.element.find('.edit-icon').on('click',function(){
        _this.setEditMode(!_this.editMode);
      });
      _this.element.find('.save-icon').on('click',function(){
        if (_this.editMode) {
          _this.saveStructures();
        }
      });
      _this.element.find('.undo-icon').on('click',function(){
        if (_this.editMode) {
          _this.revert();
          _this.setEditMode(false);
        }
      });
      _this.element.find('.add-icon').on('click',function(){
        if (_this.editMode) {
          var tree = _this.treeElement.jstree(true);
          var node_id = tree.create_node(null);
          tree.rename_node(node_id, 'New Node');
        }
      });

      _this.eventEmitter.subscribe('tabStateUpdated.' + _this.windowId, function(_, data) {
        _this.tabStateUpdated(data);
      });

      _this.eventEmitter.subscribe(('currentCanvasIDUpdated.' + _this.windowId), function(event, canvasID) {
        function findRanges(ranges, canvasID, rangeIDs){
          if(!rangeIDs) rangeIDs = [];
          ranges.forEach(function(range){
            if (range.canvases.includes(canvasID)) rangeIDs.push(range['@id']);
            findRanges(range.children, canvasID, rangeIDs);
          });
          return rangeIDs;
        }
        _this.setSelectedElements(findRanges(_this.structures.children, canvasID).concat([canvasID]));
      });
      
      var allCanvasURIs = this.manifest.getCanvases().map(function(canvas){return canvas['@id'];});
      function canvasURIs(dragData) {
        var split = dragData.split('\n');
        return split.filter(function(s){return allCanvasURIs.includes(s);});
      }
      
      _this.element.on('dragover','li.jstree-node.range',function(event){
        if (_this.editMode){
          event.preventDefault();
          //console.log('dragover');
        }
      });
      _this.element.on('drop','li.jstree-node.range',function(event){
        if (_this.editMode){
          event.preventDefault();
          var tree = _this.treeElement.jstree(true);
          var range_node = tree.get_node(jQuery(this).attr('id'));
          if (!range_node) return;
          var canvases = canvasURIs(event.originalEvent.dataTransfer.getData('text/plain') || '');
          canvases.forEach(function(canvas){
            var label = _this.manifest.getCanvases().find(function(iiif_canvas){return iiif_canvas['@id']===canvas;}).label;
            var node = {
              'text': label,
              'icon' : 'canvas fa fa-file-text-o star',
              'children': [],
              'data': {'type':'canvas', 'uri': canvas},
              'a_attr': {'class':'toc-link'},
              'li_attr': {'class':'canvas'}
            };
            tree.create_node(range_node, node);
          });
          return false;
        }
      });

    },

    setActive: function(active) {
      var _this = this;
      _this.active = active;
    },

    setSelectedElements: function(rangeIDs) {
      var _this = this;
      var tree = this.treeElement.jstree(true);
      
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
      
      this.treeElement.find('li.jstree-node').each(handleElement);

      var head = this.treeElement.find('.selected').first();
      if (head.length > 0) {
        this.element.scrollTo(head, 400, {'axis':'y'});
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
