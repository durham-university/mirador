(function($) {

  $.IIIFTocEndpoint = function(options) {
    jQuery.extend(true, this, {
      url:           null,
      addCsrf:       null,
      method:  'POST',
      iiif_version:  2,
    }, options);

    this.init();
  };
  
  $.IIIFTocEndpoint.prototype = {
    init: function(){
    },
    
    addCsrfToRequest: function(xhr){
      xhr.setRequestHeader('X-CSRF-Token', jQuery('meta[name="csrf-token"]').attr('content'));
    },
    
    successCallback: function(data){
      console.log("Structures saved");      
    },
    
    errorCallback: function(data){
      console.log("Error saving structures");
      console.log(JSON.stringify(data, undefined, 2));
      alert("Error saving structures");
    },
    
    saveStructures: function(toc){
      var structures = toc.getStructures(this.iiif_version);
      
      ajaxOptions = {
        url: this.url,
        type: this.method,
        dataType: 'json',
        data: JSON.stringify({'ranges': structures}),
        contentType: 'application/json; charset=utf-8',
        success: this.successCallback,
        error: this.errorCallback
      };
      
      if (this.addCsrf) ajaxOptions.beforeSend = this.addCsrfToRequest;
      
      jQuery.ajax(ajaxOptions);
    },
  };

}(Mirador));
