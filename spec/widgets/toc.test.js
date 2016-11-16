describe('Table of Contents', function() {
  beforeAll(function(){
    // PhantomJS doesn't implement some Array methods. Quick and dirty implementations.
    if(typeof(Array.prototype.find)=='undefined') {
      this.arrayFindAdded = true;
      Array.prototype.find = function(callback) {
        for(var i=0;i<this.length;i++){
          if(callback.call(this, this[i])) return this[i];
        }
      };
    }
    if(typeof(Array.prototype.findIndex)=='undefined') {
      this.arrayFindIndexAdded = true;
      Array.prototype.findIndex = function(callback) {
        for(var i=0;i<this.length;i++){
          if(callback.call(this, this[i])) return i;
        }
      };
    }
    if(typeof(Array.prototype.includes)=='undefined') {
      this.arrayIncludesAdded = true;
      Array.prototype.includes = function(item) {
        for(var i=0;i<this.length;i++){
          if(this[i] == item) return true;
        }
        return false;
      };
    }    
  });
  afterAll(function(){
    if (this.arrayFindAdded) delete(Array.prototype.find);
    if (this.arrayFindIndexAdded) delete(Array.prototype.findIndex);
    if (this.arrayIncludesAdded) delete(Array.prototype.includes);
  });
  beforeEach(function(){
    jasmine.getJSONFixtures().fixturesPath = 'spec/fixtures';

    this.eventEmitter = new Mirador.EventEmitter();
    
    // this.v1SimpleStructures = getJSONFixture('simpleStructuresFixtureV1.json'),
    // this.v1SimpleStructuresTemplateData = '[{"@id":"http://www.example.org/iiif/book1/range/r1.json","@type":"sc:Range","label":"Introduction","canvases":["http://www.example.org/iiif/book1/canvas/p1.json"],"id":"http://www.example.org/iiif/book1/range/r1.json","within":"root","level":0,"children":[{"@id":"http://www.example.org/iiif/book1/range/r2.json","@type":"sc:Range","label":"Part 1","within":"http://www.example.org/iiif/book1/range/r1.json","canvases":["http://www.example.org/iiif/book1/canvas/p2.json","http://www.example.org/iiif/book1/canvas/p3.json#xywh=0,0,750,300"],"id":"http://www.example.org/iiif/book1/range/r2.json","level":1}]}]',
    this.v2SimpleStructures = getJSONFixture('simpleStructuresFixtureV2.json');
    // v21SimpleStructures = getJSONFixture('simpleStructuresFixtureV21.json'),
    // this.realisticV1 = getJSONFixture('Richardson7manifest.json'),
    // this.realisticV2 = getJSONFixture('BNF-condorcet-florus-dispersus-manifest.json');
    // this.realisticV21 = {},

    this.structures = this.v2SimpleStructures;
    
    var _this = this;
    this.manifest = {
      getVersion: function() { return '2'; },
      getStructures: function() { return _this.structures['structures']; },
      getCanvases: function() {
        var s = this.getStructures();
        var top = s.find(function(s){return s['viewingHint']=='top';});
        if(!top) return [];
        return top['canvases'];
      }
    };
    this.sandbox = sandbox();
    this.omitRootNode = true;
    this.autoCreateRootNode = "Table of contents";
    
    this.initToc=function(){
      return new Mirador.TableOfContents({
        manifest: this.manifest,
        appendTo: this.sandbox,
        windowId: 'dummyID',
        canvasID: 1234,
        endpointConfig: {},
        eventEmitter: this.eventEmitter,
        omitRootNode: this.omitRootNode,
        autoCreateRootNode: this.autoCreateRootNode
      });      
    };      
  });

  afterEach(function() {
    // JSON is modified in tests, clear cache so fixtures are loaded again
    jasmine.getJSONFixtures().clearCache();
  });
    
  describe('init', function(){
    beforeEach(function(){
      spyOn(Mirador.TableOfContents.prototype,'initStructures');
      spyOn(Mirador.TableOfContents.prototype,'resetTree');
      spyOn(Mirador.TableOfContents.prototype,'bindEvents');      
    });
    it('should create tree container', function(){
      this.initToc();
      expect(this.sandbox.find('.toc-tree')).toExist();      
    });
    
    it('should create tool container', function(){
      this.initToc();
      expect(this.sandbox.find('.toc-tools .edit-icon')).toExist();
      expect(this.sandbox.find('.toc-tools .toc-edit-tools')).toExist();
      expect(this.sandbox.find('.toc-tools .toc-edit-tools .save-icon')).toExist();
    });
    
    it('should init structures', function(){
      this.initToc();
      expect(Mirador.TableOfContents.prototype.initStructures).toHaveBeenCalled();
    });
    
    it('should init tree', function(){
      this.initToc();
      expect(Mirador.TableOfContents.prototype.resetTree).toHaveBeenCalled();      
    });
    
    it('should bind events', function(){
      this.initToc();
      expect(Mirador.TableOfContents.prototype.bindEvents).toHaveBeenCalled();
    });
  });


  describe('initStructures',function(){
    beforeEach(function(){
      spyOn(Mirador.TableOfContents.prototype,'resetTree');
      spyOn(Mirador.TableOfContents.prototype,'bindEvents');      
      spyOn(this.manifest,'getStructures').and.callThrough();
    });
    it('unflattens manifest structures', function(){
      var toc = this.initToc();
      expect(this.manifest.getStructures).toHaveBeenCalled();
      expect(toc.structures['@id']).toEqual('root')
      expect(toc.structures.parent).toEqual(null)
      expect(toc.structures.children.length).toEqual(1)
      var root_struct = toc.structures.children[0]
      expect(root_struct['@id']).toEqual('http://www.example.org/iiif/book1/range/r1.json')
      expect(root_struct.parent).toEqual(toc.structures)
      expect(root_struct.canvases.length).toEqual(3)
      expect(root_struct.children.length).toEqual(1)
      var sub_struct = root_struct.children[0];
      expect(sub_struct['@id']).toEqual('http://www.example.org/iiif/book1/range/r2.json')
      expect(sub_struct.parent).toEqual(root_struct)
      expect(sub_struct.canvases.length).toEqual(2)
      expect(sub_struct.children.length).toEqual(0)
    });
  });
  
  describe('revert',function(){
    it('resets structures', function(){
      var toc = this.initToc();
      toc.structures={'@id':'new_root','children':[]}
      toc.revert();
      expect(toc.structures['@id']).toEqual('root')
      expect(toc.structures.children.length).toEqual(1)
      var root_struct = toc.structures.children[0]
      expect(root_struct['@id']).toEqual('http://www.example.org/iiif/book1/range/r1.json')
    });
  });
  
  describe('saveStructures',function(){
    it('uses end point to save structures', function(){
      var toc = this.initToc();
      var endpoint = jasmine.createSpyObj('endpoint', ['saveStructures']);
      spyOn(toc,'getEndpoint').and.returnValue(endpoint);
      toc.saveStructures();
      expect(endpoint.saveStructures).toHaveBeenCalledWith(toc);
    });
  });
  
  describe('getEndPoint',function(){
    beforeEach(function(){ Mirador.TestEndpoint = function(options){}; });
    afterEach(function(){ delete(Mirador.TestEndpoint); });
    it('uses endpointConfig to create the endpoint', function(){
      var toc = this.initToc();
      toc.endpointConfig = {
        'module': 'TestEndpoint',
        'options': { 'test': 'foo' }
      };
      spyOn(Mirador,'TestEndpoint').and.callThrough();
      var endpoint = toc.getEndpoint();
      expect(Mirador.TestEndpoint).toHaveBeenCalledWith({'test': 'foo'});
      expect(endpoint.constructor).toEqual(Mirador.TestEndpoint);
    });
  });
  
  describe('getStructures',function(){
    it('flattens structures', function(){
      var toc = this.initToc();
      var root_struct = toc.structures.children[0];
      var sub_struct = root_struct.children[0];
      sub_struct.label = 'Changed label'
      var structures = toc.getStructures();
      expect(structures.length).toEqual(2);
      expect(structures[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(structures[0].label).toEqual("Introduction");
      expect(structures[0].canvases).toEqual(["http://www.example.org/iiif/book1/canvas/p1.json", "http://www.example.org/iiif/book1/canvas/p2.json", "http://www.example.org/iiif/book1/canvas/p3.json"]);
      expect(structures[1]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      expect(structures[1].label).toEqual("Changed label");
      expect(structures[1].canvases).toEqual(["http://www.example.org/iiif/book1/canvas/p2.json", "http://www.example.org/iiif/book1/canvas/p3.json"]);
    });
    it('returns V1 structures', function(){
      var toc = this.initToc();
      var structures = toc.getStructures('1');
      expect(structures.length).toEqual(2);
      expect(structures[0].ranges).toBeUndefined();
      expect(structures[1].within).toEqual(structures[0]['@id'])
    });
    it('returns V2 structures', function(){
      var toc = this.initToc();
      var structures = toc.getStructures('2');
      expect(structures.length).toEqual(2);
      expect(structures[0].ranges).toEqual([structures[1]['@id']]);
      expect(structures[1].within).toBeUndefined();
    });
    it('sets viewingHint=top', function(){
      this.omitRootNode = false;
      var toc = this.initToc();
      var root_struct = toc.structures.children[0];
      var new_root = {
        '@id': 'jstree:test_1',
        '@type': 'sc:Range',
        'canvases': root_struct.canvases,
        'children': [root_struct],
        'label': 'New root',
        'parent': toc.structures
      };
      root_struct.parent = new_root;
      toc.structures.children = [new_root];
      var structures = toc.getStructures();
      expect(structures.length).toEqual(3);
      expect(structures[0]['@id']).toEqual('jstree:test_1');
      expect(structures[0].viewingHint).toEqual('top');
      expect(structures[1]['@id']).toEqual(root_struct['@id']);
      expect(structures[1].viewingHint).toBeUndefined();
    });
    
  });
  
  describe('setEditMode',function(){
    it('adds and removes editing class', function(){
      var toc = this.initToc();
      spyOn(toc,'resetTree');
      expect(toc.element.hasClass('editing')).toEqual(false);
      toc.setEditMode(true);
      expect(toc.element.hasClass('editing')).toEqual(true);
      toc.setEditMode(false);
      expect(toc.element.hasClass('editing')).toEqual(false);
      expect(toc.resetTree.calls.count()).toEqual(2);
    });
    it('sets and resets editMode flag', function(){
      var toc = this.initToc();
      spyOn(toc,'resetTree');
      expect(toc.editMode).toEqual(false);
      toc.setEditMode(true);
      expect(toc.editMode).toEqual(true);
      toc.setEditMode(false);
      expect(toc.editMode).toEqual(false);
    });
    it('resets the tree', function(){
      var toc = this.initToc();
      spyOn(toc,'resetTree');      
      toc.setEditMode(true);
      expect(toc.resetTree).toHaveBeenCalled();
    });
  });
  
  describe('resetTree',function(){
    it("inits the tree", function(){
      var toc = this.initToc();
      spyOn(toc,'initTreeData');      
      spyOn(toc,'initTree');      
      toc.resetTree();
      expect(toc.initTreeData).toHaveBeenCalled();
      expect(toc.initTree).toHaveBeenCalled();
    });
  });
  
  describe('initTreeData', function(){
    // constructor calls resetTree which calls initTreeData
    it("creates a root node if enabled in settings", function(){
      this.structures['structures'] = [];
      var toc = this.initToc();
      var structures = toc.getStructures();
      expect(structures.length).toEqual(1);
      expect(structures[0]['@id'].substring(0,7)).toEqual('jstree:')
      expect(structures[0].label).toEqual('Table of contents');
      expect(structures[0].viewingHint).toEqual('top');
    });
    it("doesn't create a root node when not enabled in settings", function(){
      this.autoCreateRootNode = null;
      this.structures['structures'] = [];
      var toc = this.initToc();
      var structures = toc.getStructures();
      expect(structures.length).toEqual(0);
    });
    it("omits a root node if enabled in settings", function(){
      var toc = this.initToc();
      expect(toc.rootRange['@id']).toEqual(this.structures['structures'][0]['@id']);
    });
    it("doesn't omit a root node if not enabled in settings", function(){
      this.omitRootNode = false;
      var toc = this.initToc();
      expect(toc.rootRange['@id']).toEqual('root');
    });
  });
  
  describe('events', function(){
    describe('activate_node', function(){
      it('publishes event when triggered by range', function(){
        var toc = this.initToc();
        spyOn(this.eventEmitter, 'publish');
        spyOn(toc, 'getIIIFRange').and.returnValue({'canvases':['rangeid']})
        toc.treeElement.trigger('activate_node',[{ 'node': {'data': {'type': 'range'}} }]);
        expect(this.eventEmitter.publish).toHaveBeenCalledWith('SET_CURRENT_CANVAS_ID.'+toc.windowId, 'rangeid');
      });
      it('publishes event when triggered by canvas', function(){
        var toc = this.initToc();
        spyOn(this.eventEmitter, 'publish');
        toc.treeElement.trigger('activate_node',[{ 'node': {'data': {'type': 'canvas', 'uri': 'canvasuri'}} }]);
        expect(this.eventEmitter.publish).toHaveBeenCalledWith('SET_CURRENT_CANVAS_ID.'+toc.windowId, 'canvasuri');
      });
    });
    describe('create_node', function(){
      it('adds a range node', function(){
        var toc = this.initToc();
        expect(toc.structures.children[0].children.length).toEqual(1);
        toc.treeElement.trigger('create_node',[{ 'parent': toc.structures.children[0]['@id'], 'node': { 'text':'New range', 'id':'jstreeX', 'a_attr':{}, 'li_attr':{} } }]);
        expect(toc.structures.children[0].children[1].label).toEqual('New range');
        expect(toc.structures.children[0].children[1]['@type']).toEqual('sc:Range');
        expect(toc.structures.children[0].children[1].parent).not.toBeUndefined();
      });
      it('adds a canvas node', function(){
        var toc = this.initToc();
        expect(toc.structures.children[0].canvases.length).toEqual(3);
        toc.treeElement.trigger('create_node',[{ 'parent': toc.structures.children[0]['@id'], 'node': { 'data': {'type': 'canvas', 'uri':"http://www.example.org/iiif/book1/canvas/newcanvas.json"} } }]);
        expect(toc.structures.children[0].canvases[3]).toEqual("http://www.example.org/iiif/book1/canvas/newcanvas.json");
      });
    });
    describe('rename_node', function(){
      it('renames a node', function(){
        var toc = this.initToc();
        toc.treeElement.trigger('rename_node',[{ 'node': toc.structures.children[0]['@id'], 'text':'New name' }]);
        expect(toc.structures.children[0].label).toEqual("New name");        
      });
    });
    describe('delete_node', function(){
      it('deletes a range', function(){
        var toc = this.initToc();
        var range_uri = toc.structures.children[0].children[0]['@id'];
        var parent_uri = toc.structures.children[0]['@id'];
        spyOn(toc,'removeRangeFromRange').and.callFake(function(range, parent){
          expect(range.data.uri).toEqual(range_uri);
          expect(parent).toEqual(parent_uri);
        });
        toc.treeElement.trigger('delete_node',[{ 'node': { 'data': { 'type': 'range', 'uri': range_uri} }, 'parent': parent_uri}]);
        expect(toc.removeRangeFromRange).toHaveBeenCalled();
      });
      it('deletes a canvas', function(){
        var toc = this.initToc();
        spyOn(toc,'removeCanvasFromRange').and.callThrough();
        var canvas_uri = toc.structures.children[0].children[0].canvases[0];
        var parent_uri = toc.structures.children[0].children[0]['@id'];
        toc.treeElement.trigger('delete_node',[{ 'node': { 'data': { 'type': 'canvas', 'uri': canvas_uri} }, 'parent': parent_uri}]);
        expect(toc.removeCanvasFromRange).toHaveBeenCalledWith(canvas_uri, parent_uri);
      });
    });
    describe('move_node', function(){
      var range3 = {
        "@id": "http://www.example.org/iiif/book1/range/r3.json",
          "@type":"sc:Range",
          "label":"Part 2",
          "canvases": []
      };
      it('moves a range', function(){
        var toc = this.initToc();
        toc.structures.children[0].children.push(range3);
        var range_uri = toc.structures.children[0].children[0]['@id'];
        var old_parent_uri = toc.structures.children[0]['@id'];
        var new_parent_uri = toc.structures.children[0].children[1]['@id'];
        spyOn(toc,'removeRangeFromRange').and.callFake(function(range,parent){
          expect(range['@id']).toEqual(range_uri);
          expect(parent).toEqual(old_parent_uri);
        });
        spyOn(toc,'addRangeToRange').and.callFake(function(range,parent){
          expect(range['@id']).toEqual(range_uri);
          expect(parent).toEqual(new_parent_uri);          
        });
        toc.treeElement.trigger('move_node',[{ 'node': { 'data': { 'type': 'range', 'uri': range_uri} }, 'parent': new_parent_uri, 'old_parent': old_parent_uri}]);
        expect(toc.removeRangeFromRange).toHaveBeenCalled();
        expect(toc.addRangeToRange).toHaveBeenCalled();
      });
      it('moves a canvas', function(){
        var toc = this.initToc();
        toc.structures.children[0].children.push(range3);
        var canvas_uri = toc.structures.children[0].children[0].canvases[1];
        var old_parent_uri = toc.structures.children[0].children[0]['@id'];
        var new_parent_uri = toc.structures.children[0].children[1]['@id'];
        spyOn(toc,'removeCanvasFromRange');
        spyOn(toc,'addCanvasToRange');
        toc.treeElement.trigger('move_node',[{ 'node': { 'data': { 'type': 'canvas', 'uri': canvas_uri} }, 'parent': new_parent_uri, 'old_parent': old_parent_uri}]);
        expect(toc.removeCanvasFromRange).toHaveBeenCalledWith(canvas_uri, old_parent_uri);
        expect(toc.addCanvasToRange).toHaveBeenCalledWith(canvas_uri, new_parent_uri);
      });
    });
    describe('copy_node', function(){
      it('copies a canvas', function(){
        var toc = this.initToc();
        var canvas_uri = toc.structures.children[0].canvases[0];
        var parent_uri = toc.structures.children[0].children[0]['@id'];
        spyOn(toc,'addCanvasToRange');
        toc.treeElement.trigger('copy_node',[{ 'node': {}, 'original': { 'data': { 'type': 'canvas', 'uri': canvas_uri} }, 'parent': parent_uri}]);
        expect(toc.addCanvasToRange).toHaveBeenCalledWith(canvas_uri, parent_uri);
      });
    });
  });
  
  describe('removeCanvasFromRange',function(){
    it("doesn't remove if canvas is in a child range", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p2.json");
      toc.removeCanvasFromRange("http://www.example.org/iiif/book1/canvas/p2.json", "http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p2.json");
    });
    it("removes if canvas is not in a child range", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p1.json");
      toc.removeCanvasFromRange("http://www.example.org/iiif/book1/canvas/p1.json", "http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].canvases).not.toContain("http://www.example.org/iiif/book1/canvas/p1.json");
    });
    it("removes from parent", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p2.json");
      toc.removeCanvasFromRange("http://www.example.org/iiif/book1/canvas/p2.json", "http://www.example.org/iiif/book1/range/r2.json");
      expect(toc.structures.children[0].canvases).not.toContain("http://www.example.org/iiif/book1/canvas/p2.json");
    });
  });
  
  describe('addCanvasToRange',function(){
    it("adds the canvas to range", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      toc.addCanvasToRange("http://www.example.org/iiif/book1/canvas/newcanvas.json", "http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/newcanvas.json");
    });
    it("adds the canvas to parent", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      toc.addCanvasToRange("http://www.example.org/iiif/book1/canvas/newcanvas.json", "http://www.example.org/iiif/book1/range/r2.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/newcanvas.json");
    });
  });
  
  describe('removeRangeFromRange',function(){
    it("removes the range", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      toc.removeRangeFromRange("http://www.example.org/iiif/book1/range/r2.json", "http://www.example.org/iiif/book1/range/r1.json")
      expect(toc.structures.children[0].children.length).toEqual(0);
    });
    it("removes contained canvases from parent", function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p1.json");
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/p2.json");
      toc.removeRangeFromRange("http://www.example.org/iiif/book1/range/r2.json", "http://www.example.org/iiif/book1/range/r1.json")
      expect(toc.structures.children[0].canvases).toEqual(["http://www.example.org/iiif/book1/canvas/p1.json"]);
    });
  });
  
  describe('addRangeToRange',function(){
    var new_range = {
      "@id":"http://www.example.org/iiif/book1/range/newrange.json",
      "@type":"sc:Range",
      "label":"New range",
      "canvases":["http://www.example.org/iiif/book1/canvas/newpage.json"]
    };
    it('adds the range', function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      toc.addRangeToRange(new_range,"http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[1]['@id']).toEqual("http://www.example.org/iiif/book1/range/newrange.json");
    });
    it('adds the range with index', function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
      toc.addRangeToRange(new_range,"http://www.example.org/iiif/book1/range/r1.json",0);
      expect(toc.structures.children[0].children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/newrange.json");
      expect(toc.structures.children[0].children[1]['@id']).toEqual("http://www.example.org/iiif/book1/range/r2.json");
    });
    it('adds contained canvases to parent', function(){
      var toc = this.initToc();
      expect(toc.structures.children[0]['@id']).toEqual("http://www.example.org/iiif/book1/range/r1.json");
      toc.addRangeToRange(new_range,"http://www.example.org/iiif/book1/range/r1.json",0);      
      expect(toc.structures.children[0].canvases).toContain("http://www.example.org/iiif/book1/canvas/newpage.json");
    });
  });
});
