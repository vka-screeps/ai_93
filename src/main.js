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
	this.tbl[d.name] = c;
    }

    make(d) {
	let cls = this.tbl[d.cname];
	if ( cls  ) {
	    return cls(d);
	} else {
	    console.log("Can't find class: " + d.cname);
	}
	
    }
};


//var f; //  =new F()

var glb = {};

function initGlb() {
    glb.rooms = new MemList( Memory.rooms );
    glb.rooms = new MemList( Memory.creeps );
}

class MemList {
    constructor(d) {
	this.d = d;
	this.list = [];

	this.d.forEach( function(o) {
	    this.list.push( f.make(o.user_data) );
	} );
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


var allClasses = [ Goals, Goal, GoalStart, GoalDefence ];

function regClasses( list ) {
    if(!f)
	f = new F();
    
    list.forEach( function(c) {
	f.reg(c); } );
}


/* */
/*
var allGoals = {
    "g_start" : new GoalStart(),
    "g_def" : new GoalDefence()
};

function doGoals(rm) {
    let rm_name = rm.name;
    
    if (!Memory.rooms[rm_name].str_data)
	initStrDataMemory(rm_name);

    var str_data = Memory.rooms[rm_name].str_data;
    for( let gi in allGoals ) {
	let g = allGoals[gi];
	
    }
}

function initStrDataMemory(rm_name) {
    Memory.rooms['sim'].str_data = {
	curRoleTable : [];
	curGoals : [];
    };
}

*/


console.log('new global');
module.exports.loop = function() {
    u.init();
    config.updateConfig();

    if ((Game.time % 10000) == 0) {
	stat.clear();
    }

    console.log('new tick');
    myroom();

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
}
