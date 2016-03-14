var _ = require('lodash');
var u = require('utils');

module.exports = {
    init: function() { m_init() },
    f : f,
    cf : F
}


// Factory
var F = class {
    constructor() {
	this.tbl={}
    }

    reg(c) {
	u.log("Registering: " + c.cname(), u.LOG_INFO);
	this.tbl[c.cname()] = c;
    }

    make(d, parent) {
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    u.log("Instantiating: " + d.cname, u.LOG_INFO);	    
	    return new cls(d, parent);
	} else {
	    u.log("Can't find class: " + d.cname, u.LOG_WARN);
	}
    }
};

var f = new F();

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

class Job extends CMemObj {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'Job'; }
}

class JobMiner extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobMiner'; }
}

class JobCarrier extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobCarrier'; }    
}

// class CCreep extends CMemObj {
//     constructor(d, parent) {
// 	super(d, parent);
// 	this.croom = this.parent.parent.rooms[d.id_room];
// 	this.role = f.make(d.role, this);
//     }
// }

var allClasses = [ Job, JobMiner, JobCarrier ];
