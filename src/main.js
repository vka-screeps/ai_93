var _ = require('lodash');
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

    make(d, parent) {
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    return new cls(d, parent);
	} else {
	    u.log("Can't find class: " + d.cname, u.LOG_WARN);
	}
	
    }
};


var f; //  =new F()

var glb; // = {};

class MemList {

    // d - e.g. Memory.rooms
    // cn - 'CRoom'
    // coll - Game.rooms
    constructor(parent, d, cn, coll) {
	this.list = {};
	this.d = d;
	this.parent = parent;
	
	for ( let oi in d ) {
	    let o = d[oi];
	    if(!o.cname) {
		o.cname = cn;
		o.name = oi;
		o.id = coll[o.name].id;
	    }
	    this.list[o.id] = f.make(o, this);
	}
    }
}


// TODO - delete unused code
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

class CRoom extends CMemObj {
    constructor(d, parent) {
	super(d, parent);
    }
}

class CCreep extends CMemObj {
    constructor(d, parent) {
	super(d, parent);
	this.croom = this.parent.parent.rooms[d.id_room];
	this.role = f.make(d.role, this);
    }
}

class CRole {
    constructor(d, parent) {
	this.d = d;
	this.parent = parent;

	let croom = this.parent.croom;
	this.crolet = croom.lst_crolet[this.d.id_rolet];
    }

    process(ccreep) {
	u.log( "CRole.process (" + ccreep.d.name + ")" );
    }
}

class Goal {
    constructor(d, parent) {
	this.d = d;
	this.parent = parent;
    }

    init(rm, str_data) {
    }
}

class GoalStart extends Goal {
    constructor(d, parent) {
	super(d, parent);
    }

    init(rm, str_data) {
	if(!this.d.running) {
	    this.d.running = 1;
	    u.log("Starting GoalStart...");
	}
	str_data.curRoleTable = [];
	str_data.curRoleTable.push( {role_id: 'h1', count: 1 } );
	return true;
    }
}

class GoalDefence extends Goal {
    constructor(d, parent) {
	super(d, parent);
    }

    init(rm, str_data) {
	str_data.curRoleTable.push( {role_id: 'free', count: 1 } );
	return true;
    }
}


var allClasses = [ Goals, Goal, GoalStart, GoalDefence, CRoom, CCreep, CRole ];

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
	curGoals : {},
	specialization : ""
    };
}

function initGlb() {
    glb = {};
    glb.rooms = new MemList( glb, Memory.rooms, 'CRoom', Game.rooms ); // must go 1st
    glb.creeps = new MemList( glb, Memory.creeps, 'CCreep', Game.creeps );
}

function planGoals() {

    for(let rmi in glb.rooms.list) {
	let rm = glb.rooms.list[rmi];

	if (!rm.d.str_data)
	    initStrDataMemory(rm.d.name);

	var str_data = rm.d.str_data;
	if(str_data.specialization == "growth") {
	    if(!rm.d.my_creep_cnt) {
		// no creeps in the room
		if(!str_data.curGoals.start)
		    str_data.curGoals.start = {cname : 'GoalStart'};

		str_data.curGoals.start.active = 1;
	    }
	}
    }
}

function runGoals() {
    for(let rmi in glb.rooms.list) {
	let rm = glb.rooms.list[rmi];

	if (!rm.d.str_data)
	    continue;
	
	var str_data = rm.d.str_data;
	for( let gi in str_data.curGoals ) {
	    let goal = f.make(str_data.curGoals[gi], rm);
	    goal.init( rm, str_data );
	}
    }
}

/*
function makeNewCreep(crm, spawn, id_crolet) {
    let 
}
*/

u.initLog();
Memory.log_level['global'] = 3;

u.log('new global');

regClasses(allClasses);

config.updateConfig();

/******************************************************************************/
module.exports = {
    loop : function() {

	if(!glb)
	    initGlb();

	/*
	if ((Game.time % 10000) == 0) {
	    stat.clear();
	}
	*/

	u.log('new tick');
	
	// collect stats
	myroom();

	planGoals();

	runGoals();

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
