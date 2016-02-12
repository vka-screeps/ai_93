var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var u = require('utils');
var config = require('config');
var stat = require('stat');

//config.rooms = [];


//u.init();


var F = class {
    constructor() {
	this.tbl={}
    }

    reg(c) {
	this.tbl[c.name] = c;
    }

    make(d) {
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    return new cls(d);
	} else {
	    console.log("Can't find class: " + d.cname);
	}
	
    }
};


var f; //  =new F()

var glb = {};

class MemList {

    // d - e.g. Memory.rooms
    // cn - 'CRoom'
    // coll - Game.rooms
    constructor(d, cn, coll) {
	this.d = d;
	this.list = [];

	for ( let oi in d ) {
	    let o = d[oi];
	    if(!o.cname) {
		o.cname = cn;
		o.name = oi;
		o.id = coll[o.name].id;
	    }
	    this.list.push( f.make(o) );
	}
    }
}

class Goals {
    constructor(d) {
	this.d = d;
	this.list = [];

	this.d.goals.forEach( function(goal) {
	    this.list.push( f.make(goal) );
	} );
    }
}




class CMemObj {
    constructor(d) {
	this.d = d;
    }

    getObjLogName() {
	return this.d.cname + "(" + this.d.name + ", " + this.d.id + ")";
    }

    getObj() {
	if( this.d && this.d.id )
	    return Game.getObjectById(this.d.id);

	console.log( "Can't find object - " + this.getObjLogName() );
	return null;
    }
}

class CRoom extends CMemObj {
    constructor(d) {
	super(d);
    }
}

class CCreep extends CMemObj {
    constructor(d) {
	super(d);
    }
}

class Goal {
    constructor(d) {
	this.d = d;
    }
}

class GoalStart extends Goal {
    constructor(d) {
	super(d);
    }

    init(rm, str_data) {
	str_data.curRoleTable = [];
	str_data.curRoleTable.push( {role_id: 'h1', count: 1 } );
	return true;
    }
}

class GoalDefence extends Goal {
    constructor(d) {
	super(d);
    }

    init(rm, str_data) {
	str_data.curRoleTable.push( {role_id: 'free', count: 1 } );
	return true;
    }
}


var allClasses = [ Goals, Goal, GoalStart, GoalDefence, CRoom, CCreep ];

function regClasses( list ) {
    if(!f)
	f = new F();
    
    list.forEach( function(c) {
	f.reg(c); } );
}


var allGoals = {
    "g_start" : new GoalStart(),
    "g_def" : new GoalDefence()
};



function initStrDataMemory(rm_name) {
    Memory.rooms[rm_name].str_data = {
	curRoleTable : [],
	curGoals : [],
	specialization : ""
    };
}

function initGlb() {
    glb = {};
    glb.rooms = new MemList( Memory.rooms, 'CRoom', Game.rooms );
    glb.creeps = new MemList( Memory.creeps, 'CCreep', Game.creeps );
}

function planGoals() {


    for(let rmi in glb.rooms) {
	let rm = glb.rooms[rmi];

	if (!rm.d.str_data)
	    initStrDataMemory(rm.d.name);

	var str_data = rm.d.str_data;
	if(str_data.specialization == "growth") {
	    if(!rm.d.my_creep_cnt) {
		u.log( "Starting GoalStart" );
		str_data.curGoals = [];
		str_data.curGoals.push( {cname : 'GoalStart' } );
	    }
	}
    }
}


console.log('new global');

regClasses(allClasses);
initGlb();

config.updateConfig();

/******************************************************************************/
module.exports = {
    loop : function() {

	/*
	if ((Game.time % 10000) == 0) {
	    stat.clear();
	}
	*/

	console.log('new tick');
	
	// collect stats
	myroom();

	planGoals();

	for(var name in Game.creeps) {
	    var creep = Game.creeps[name];

	    if(creep.memory.role == 'harvester') {
		u.crstr_do_harvest(creep);
		// harvester(creep);
	    }

	    else if(creep.memory.role == 'workonly') {
		u.crstr_do_workonly(creep);
		// harvester(creep);
	    }    

	    else if(creep.memory.role == 'harv') {
		u.crstr_do_harv(creep);
	    }

	    else if(creep.memory.role == 'carry') {
		u.crstr_do_carry(creep);
	    }

	    else if(creep.memory.role == 'archer') {
		u.crstr_do_archer(creep);
	    }    

	    if(creep.memory.role == 'cr') {
		u.crstr_do_control(creep);
	    }

	    if(creep.memory.role == 'builder') {
		u.crstr_do_build(creep);
	    }

	    if(creep.memory.role == 'testtgt') {
		u.crstr_do_testtgt(creep);
	    }    
	    
	    if(creep.memory.role == 'guard') {
		var targets = creep.room.find(FIND_HOSTILE_CREEPS);
		if(targets.length) {
		    creep.moveTo(targets[0]);
		    creep.attack(targets[0]);
		}
	    }
	}
    },

    printAll : function() {
	u.printObject(glb);
    }
}
