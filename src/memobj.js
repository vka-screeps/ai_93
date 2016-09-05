var u = require('utils');
var _ = require('lodash');



// Factory
var F = class {
    constructor() {
	this.tbl={}
    }

    reg(c) {
	u.log("Registering class: " + c.cname(), u.LOG_DBG);
	this.tbl[c.cname()] = c;
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
};

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
};



module.exports = function() {
    let f = new F();
    regClasses = function ( list ) {
	list.forEach( function(c) {
	    f.reg(c); } );
    };
    
    return {
	f: f,
	CMemObj: CMemObj,
	regClasses: regClasses,
    };
};
