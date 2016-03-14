var _ = require('lodash');
var u = require('utils');

module.exports = {
    init: function() { m_init() },
    f : m_f,
    cf : F
}

allClasses = [ Job, JobMiner, JobCarrier ];

// Factory
var F = class {
    constructor() {
	this.tbl={}
    }

    reg(c) {
	this.tbl[c.name] = c;
    }

    make(d, parent) {
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    return new cls(d, parent);
	} else {
	    u.log("Can't find class: " + d.cname, u.LOG_WARN);
	}
	
    }
};

var m_f = new F();

function m_init() {
    regClasses(allClasses);
}



function regClasses( list ) {
    if(!f)
	f = new F();
    
    list.forEach( function(c) {
	f.reg(c); } );
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
}
