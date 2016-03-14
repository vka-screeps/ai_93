var _ = require('lodash');
var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var u = require('utils');
var config = require('config');
var stat = require('stat');
//var r = require('roles');

var r = {
    init: function() { m_init() },
    f : f,
    cf : F,
    planSpawnJobs : planSpawnJobs,
    assignSpawnJobs : assignSpawnJobs,
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

function getDesign( design, sp, rm ) {
    if(design == 'h1') {
	return [WORK, CARRY, MOVE];
    }

    return [WORK, CARRY, MOVE];
}

class JobSpawn extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobSpawn'; }

    do_work(rm) {
	let d = this.d;
	let spawn = Game.getObjectById(d.taken_by_id);
	let mem = {
	    bal_id : d.bal_id,
	    role: {
		name: rm.memory.balance[d.bal_id].role,
		job_id: null,
		initTime: null,
		workStatus: null,
	    },
	};


	let body = getDesign(d.design, spawn, rm);
	
	u.log("Spawning " + mem.role.name + " at " + spawn.name + " : " + body, u.LOG_INFO);
	
	let result = spawn.createCreep(body, undefined, mem);

	if(_.isString(result)) {
	    console.log('The name is: '+result);
	}
	else {
	    console.log('Spawn error: '+result);
	}

    }
}

// class CCreep extends CMemObj {
//     constructor(d, parent) {
// 	super(d, parent);
// 	this.croom = this.parent.parent.rooms[d.id_room];
// 	this.role = f.make(d.role, this);
//     }
// }

var allClasses = [ Job, JobMiner, JobCarrier, JobSpawn ];


///////////////////////////////////////////////////////

function planSpawnJobs(rm) {
    let jobs = rm.memory.jobs;
    if (!jobs['JobSpawn']) jobs['JobSpawn'] = {};
    let lst = jobs['JobSpawn'];

    let priority = 0;
    for(let i in rm.memory.balance) {
	let bal_ln = rm.memory.balance[i];
	priority++;

	if(bal_ln.count > bal_ln.curCount) {
	    let job_id = bal_ln.id;
	    if(!lst[job_id]) {
		let new_job = {
		    cname: 'JobSpawn',
		    id: job_id,
		    taken_by_id: null,
		    bal_id: bal_ln.id,
		    priority: priority,
		    design: bal_ln.design
		};

		u.log("New JobSpawn: " + job_id, u.LOG_INFO);
		lst[job_id] = new_job;
	    }
	}

    }
}

function assignSpawnJobs() {

    for(let i1 in Game.spawns) {
	let spawn = Game.spawns[i1];
	if(!spawn.my)
	    continue;

	if(spawn.spawning != null)
	    continue;

	let jobs = spawn.room.memory.jobs;
	if(!jobs) {
	    u.log("No jobs for room" + spawn.room.name, u.LOG_WARN);
	    continue;
	}
	let lst = jobs['JobSpawn'];
	if(!lst)
	    continue;


	if(!spawn.memory.role) {
	    // init role
	    spawn.memory.role = {
		name: 'JobSpawn',
		job_id: null,
		initTime: 0,
		workStatus: null
	    };
	}

	if(spawn.memory.role.job_id != null) {
	    // is the job done ?

	    // release the job
	    u.log("Spawn " + spawn.name + " finished " + spawn.memory.role.job_id, u.LOG_INFO);
	    let job = lst[spawn.memory.role.job_id];
	    if(job != null) {
		delete lst[spawn.memory.role.job_id];
	    }
	    spawn.memory.role.job_id = null;
	}

	for(let i2 in lst) {
	    let job = lst[i2];

	    if(job.taken_by_id != null)
		continue;

	    // take the job
	    u.log("Spawn " + spawn.name + " takes " + job.id, u.LOG_INFO);
	    spawn.memory.role.job_id = job.id;
	    job.taken_by_id = spawn.id;

	    // work on it

	    let cjob = f.make(job, null);
	    cjob.do_work(spawn.room);

	    break;
	}
    }    
}



//config.rooms = [];


//u.init();

// Factory
/*
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
    // cn - e.g. 'CRoom' - default class name, if none exists. TODO: use a function.
    // coll - e.g. Game.rooms - helps to find out the obj's id. 
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


var allClasses = [ Goals, Goal, GoalStart, GoalDefence, CRoom, CCreep, CRole ];




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

*/
/*
function makeNewCreep(crm, spawn, id_crolet) {
    let 
}
*/

u.initLog();
Memory.log_level['global'] = 3;

u.log('new global');

//regClasses(allClasses);

config.updateConfig();

r.init();

/******************************************************************************/
module.exports = {
    loop : function() {

	/*
	if(!glb)
	    initGlb();
	*/

	/*
	if ((Game.time % 10000) == 0) {
	    stat.clear();
	}
	*/

	u.log('new tick');
	
	// collect stats
	myroom();

	r.planSpawnJobs(Game.rooms['sim']);

	r.assignSpawnJobs();

	// planGoals();

	// runGoals();

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
