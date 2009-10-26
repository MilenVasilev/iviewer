(function($){
    
    $.fn.iviewer  = function(o)
    {
        return this.each(function()
                        {
                            new $iv(this,o);
                        });
    }
    
    var defaults = {
        zoom: 0,
        zoom_max: 5,
        zoom_min: -5,
        zoom_delta: 1,
        ui_disabled: false,
        update_on_resize: true,
        //event is triggered, when zoom is changed
        //first parameter is zoom delta
        onZoom: null,
        initCallback: null
    };
    
    $.iviewer = function(e,o)
    {
        var me = this;
        
        /* object containing actual information about image
        *   @img_object.object - jquery img object
        *   @img_object.orig_{width|height} - original dimensions
        *   @img_object.display_{width|height} - actual dimensions
        */
        this.img_object = {};

        this.zoom_object = {}; //object to show zoom status
        this.current_zoom = 0;
        
        //drag variables
        this.dx = 0; 
        this.dy = 0;
        this.dragged = false;
        
        
        
        this.settings = $.extend({}, defaults, o || {});
        
        if(this.settings.src === null){
            return;
        }
            
        this.current_zoom = this.settings.zoom;
        this.container = $(e);
        
        this.update_container_info();

        //init container
        this.container.css("overflow","hidden");
         
        if(this.settings.update_on_resize == true)
        {
            $(window).resize(function()
            {
                me.update_container_info();
            });
        }
        
        //init object
        this.img_object.object = $("<img>").load(function(){
            me.img_object.display_width = me.img_object.orig_width = this.width;
            me.img_object.display_height = me.img_object.orig_height = this.height;
            $(this).css("position","absolute")
                .css("top","0px") //this is needed, because chromium sets them
                   .css("left","0px") //auto otherwise
                   .prependTo(me.container);
                   
            me.container.addClass("iviewer_cursor");

            if((me.img_object.display_width > me.settings.width) ||
               (me.img_object.display_height > me.settings.height)){
                me.fit();
            } else {
                me.moveTo(me.img_object.display_width/2, me.img_object.display_height/2);
            }
            //src attribute is after setting load event, or it won't work
        }).attr("src",this.settings.src).
        mousedown(function(e){
                  return me.drag_start(this,e);
                  }).
        mousemove(function(e){return me.drag(this,e)}).
        mouseup(function(e){return me.drag_end(this,e)}).
        mouseleave(function(e){return me.drag_end(this,e)}).
        mousewheel(function(ev, delta)
        {
            //this event is there instead of containing div, because
            //at opera it triggers many times on div
            var zoom = (delta > 0)?1:-1;
            var new_zoom = me.current_zoom + zoom;
            me.set_zoom(new_zoom);
            return false;
        });
        
        if(!this.settings.ui_disabled)
        {
            this.createui();
        }
        
        if(this.settings.initCallback)
        {
            this.settings.initCallback(this);
        }
    }
    
    
    var $iv = $.iviewer;
    
    $iv.fn = $iv.prototype = {
        iviewer : "0.3"
    }
    $iv.fn.extend = $iv.extend = $.extend;
    
    $iv.fn.extend({
                  
        //fit image in the container
        fit: function()
        {
            var aspect_ratio = this.img_object.orig_width / this.img_object.orig_height;
            var window_ratio = this.settings.width /  this.settings.height;
            var choose_left = (aspect_ratio > window_ratio);
    
            if(choose_left){
                this.img_object.display_width = this.settings.width;
                this.img_object.display_height = this.settings.width / aspect_ratio;
            }
            else {
                this.img_object.display_width = this.settings.height * aspect_ratio;
                this.img_object.display_height = this.settings.height;
            }
            this.img_object.object.attr("width",this.img_object.display_width)
                             .attr("height",this.img_object.display_height);
    
            this.center();
            this.current_zoom = -Math.floor(this.img_object.orig_height/this.img_object.display_height);
            //console.log("current zoom: " + 
            this.update_status();
        },
        
        //center image in container
        center: function()
        {
           this.img_object.object.css("top",-Math.round((this.img_object.display_height - this.settings.height)/2))
                            .css("left",-Math.round((this.img_object.display_width - this.settings.width)/2));
        },
        
        /**
        *   move a point in container to the center of display area
        *   @param x a point in container
        *   @param y a point in container
        **/
        moveTo: function(x, y)
        {
            var dx = x-Math.round(this.settings.width/2);
            var dy = y-Math.round(this.settings.height/2);
            
            var offset = this.img_object.object.offset();
            
            var new_x = offset.left - this.dx;
            var new_y = offset.top - this.dy;
            
            this.setCoords(new_x, new_y);
        },
        
        /**
        * set coordinates of upper left corner of image object
        **/
        setCoords: function(x,y)
        {
            //check new coordinates to be correct (to be in rect)
            if(y > 0){
                y = 0;
            }
            if(x > 0){
                x = 0;
            }
            if(y + this.img_object.display_height < this.settings.height){
                y = this.settings.height - this.img_object.display_height;
            }
            if(x + this.img_object.display_width < this.settings.width){
                x = this.settings.width - this.img_object.display_width;
            }
            if(this.img_object.display_width <= this.settings.width){
                x = -(this.img_object.display_width - this.settings.width)/2;
            }
            if(this.img_object.display_height <= this.settings.height){
                y = -(this.img_object.display_height - this.settings.height)/2;
            }
            
            this.img_object.object.css("top",y + "px")
                             .css("left",x + "px");
        },
        
        /**
        * set image scale to the new_zoom
        * @param new_zoom image scale. 
        * if new_zoom == 0 then display image in original size
        * if new_zoom < 0 then scale = 1/new_zoom * 100 %
        * if new_zoom > 0 then scale = 1*new_zoom * 100 %
        **/
        set_zoom: function(new_zoom)
        {
            if(new_zoom <  this.settings.zoom_min)
            {
                new_zoom = this.settings.zoom_min;
            }
            else if(new_zoom > this.settings.zoom_max)
            {
                new_zoom = this.settings.zoom_max;
            }
            
            var image_offset = this.img_object.object.offset();

            var old_x = -image_offset.left + Math.round(this.settings.width/2);
            var old_y = -image_offset.top + Math.round(this.settings.height/2);

            var new_width = $iv.scaleValue(this.img_object.orig_width, new_zoom);
            var new_height = $iv.scaleValue(this.img_object.orig_height, new_zoom);
            var new_x = $iv.scaleValue( $iv.descaleValue(old_x, this.current_zoom), new_zoom);
            var new_y = $iv.scaleValue( $iv.descaleValue(old_y, this.current_zoom), new_zoom);

            new_x = this.settings.width/2 - new_x;
            new_y = this.settings.height/2 - new_y;
            
            this.img_object.object.attr("width",new_width)
                             .attr("height",new_height);
            this.img_object.display_width = new_width;
            this.img_object.display_height = new_height;
                               
            this.setCoords(new_x, new_y);
            
            if(this.settings.onZoom !== null)
            {
                this.settings.onZoom(new_zoom - current_zoom);
            }
            
            this.current_zoom = new_zoom;
            this.update_status();
        },
        
        zoom_by: function(delta)
        {
            this.set_zoom(this.current_zoom + delta);
        },
        
        /* update scale info in the container */
        update_status: function()
        {
            if(!this.settings.ui_disabled)
            {
                var percent = Math.round(100*this.img_object.display_height/this.img_object.orig_height);
                if(percent)
                {
                    this.zoom_object.html(percent + "%");
                }
            }
        },
        
        update_container_info: function()
        {
            this.settings.height = this.container.height();
            this.settings.width = this.container.width();
        },
        
        /**
        *   callback for handling mousdown event to start dragging image
        **/
        drag_start: function(el,e)
        {
            var $el = $(el);
            /* start drag event*/
            this.dragged = true;
            this.container.addClass("iviewer_drag_cursor");
    
            this.dx = e.pageX - parseInt($el.css("left"),10);
            this.dy = e.pageY - parseInt($el.css("top"),10);
            return false;
        },
        
        /**
        *   callback for handling mousmove event to drag image
        **/
        drag: function(el,e)
        {
            if(this.dragged){
                var ltop =  e.pageY -this.dy;
                var lleft = e.pageX -this.dx;
                
                this.setCoords(lleft, ltop);
                return false;
            }
        },
        
        /**
        *   callback for handling stop drag
        **/
        drag_end: function(el,e)
        {
            this.container.removeClass("iviewer_drag_cursor");
            this.dragged=false;
        },
        
        /**
        *   create zoom buttons info box
        **/
        createui: function()
        {
            var me=this; 
            
            $("<div>").addClass("iviewer_zoom_in").addClass("iviewer_common").
            addClass("iviewer_button").
            mousedown(function(){me.set_zoom(me.current_zoom + 1); return false;}).appendTo(this.container);
            
            $("<div>").addClass("iviewer_zoom_out").addClass("iviewer_common").
            addClass("iviewer_button").
            mousedown(function(){me.set_zoom(me.current_zoom - 1); return false;}).appendTo(this.container);
            
            $("<div>").addClass("iviewer_zoom_zero").addClass("iviewer_common").
            addClass("iviewer_button").
            mousedown(function(){me.set_zoom(0); return false;}).appendTo(this.container);
            
            $("<div>").addClass("iviewer_zoom_fit").addClass("iviewer_common").
            addClass("iviewer_button").
            mousedown(function(){me.fit(this); return false;}).appendTo(this.container);
            
            this.zoom_object = $("<div>").addClass("iviewer_zoom_status").addClass("iviewer_common").
            appendTo(this.container);
            
            this.update_status(); //initial status update
        }
    });
    
    $iv.extend({
        scaleValue: function(value, toZoom)
        {
            return toZoom < 0 ? value / (Math.abs(toZoom)+1) :
                (toZoom > 0 ? value * (Math.abs(toZoom)+1) : value);
        },
        
        descaleValue: function(value, fromZoom)
        {
            return fromZoom < 0 ? value * (Math.abs(fromZoom)+1) :
                (fromZoom > 0 ? value / (Math.abs(fromZoom)+1) : value);
        }
    });
    

    
 })(jQuery);
