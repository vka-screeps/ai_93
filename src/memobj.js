var u = require('utils');
var _ = require('lodash');



// Factory
var F = class {
    constructor() {
	this.tbl={};
	this.dt_stor={}; // transient data storage
    }

    reg(c) {
	u.log("Registering class: " + c.cname(), u.LOG_DBG);
	this.tbl[c.cname()] = c;
    }

    start_new_tick() {
	this.dt_stor={};
    }

    make(d, parent) {
	if(!d)
	    return null;
	
	while(d.cname === 'ObjRef') {
	    let obj = Memory.objects[d.obj_id];
	    if(!obj) {
		u.log("Can't find object by id: " + d.obj_id, u.LOG_WARN);
		return null;
	    }
	    d = obj;
	}
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    // u.log("Instantiating: " + d.cname, u.LOG_DBG); 
	    return new cls(d, parent);
	} else {
	    u.log("Can't find class: " + d.cname, u.LOG_WARN);
	}
    }

    findClass(cname) {
	return this.tbl[cname];
    }
};




module.exports = function() {
    let f = new F();
    
    function regClasses( list ) {
	list.forEach( function(c) {
	    f.reg(c); } );
    };

    function deleteObject(cobj) {
	let objects = Memory.objects;
	
	
	if(objects[cobj.d.obj_id]) {
	    delete objects[cobj.d.obj_id];
	    return true;
	} else {
	    return false;
	}
    }

    function addObject( obj ) {

	if(!Memory.objects) {
	    Memory.objects = {
		next_id: 1
	    };
	}
	let objects = Memory.objects;

	let next_id = 'id_' + objects.next_id++;
	obj.obj_id = next_id;
	objects[next_id] = obj;
	return { cname: 'ObjRef',
		 obj_id: next_id };
    }

    class CMemObj {
	constructor(d, parent) {
	    this.d = d;
	    this.parent = parent;
	}

	getObjLogName() {
	    return this.d.cname + "(" + this.d.name + ", " + this.d.id + ")";
	}

	getObj() {
	    if( this.d && this.d.id )
		return Game.getObjectById(this.d.id);

	    u.log( "Can't find object - " + this.getObjLogName(), u.LOG_WARN);
	    return null;
	}

	makeRef() {
	    if(this.d && this.d.obj_id) {
		return { cname: 'ObjRef',
			 obj_id: this.d.obj_id };
	    } else {
		u.log( "Can't makeRef for " + this.getObjLogName(), u.LOG_WARN);
	    }
	    return null;
	}

	getTS() {
	    if(this.d && this.d.obj_id) {
		if(!f.dt_stor[this.d.obj_id]) {
		    f.dt_stor[this.d.obj_id] = {};
		}
		return f.dt_stor[this.d.obj_id];
	    } else {
		u.log( "Can't getTS for " + this.getObjLogName(), u.LOG_WARN);
	    }
	    return null;
	}
    };

    return {
	f: f,
	CMemObj: CMemObj,
	regClasses: regClasses,
	deleteObject : deleteObject,
	addObject : addObject,
    };
};
