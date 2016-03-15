var u = require('utils');
var _ = require('lodash');
var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var config = require('config');
var stat = require('stat');
//var r = require('roles');

var r = {
    init: function() { m_init() },
    f : f,
    cf : F,
    planSpawnJobs : planSpawnJobs,
    assignSpawnJobs : assignSpawnJobs,
    
    planCreepJobs : planCreepJobs,
    assignCreepJobs : assignCreepJobs,
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

    unassign(rm) {
	console.log('unassign - entry');

	let d = this.d;
	if(d.taken_by_id) {

	    // u.log( "Job.unassign id - " + d.id, u.LOG_INFO);
	    let cr = Game.getObjectById(d.taken_by_id);

	    //if(cr) {
	    let role = cr.memory.role;
	    role.job_id = null;
	    role.workStatus = null;
	// }
	    /*else {
		// find the creep's memory
		u.log( "Performance warning - Can't find creep with id - " + d.taken_by_id, u.LOG_WARN);

		for(let nm in Memory.creeps) {
		    let role = Memory.creeps[nm].role;
		    if(role) {
			if(role.job_id === d.id) {
			    role.job_id = null;
			    role.workStatus = null;
			    break;
			}
		    }
		}
	    }
	      */
	    d.taken_by_id = null;

	}

	console.log('unassign - exit');
    }
    /*
    assign(rm, cr) {
	unassign(rm);
	let d = this.d;
	d.taken_by_id = cr.id;
	cr.memory.role.job_id = d.id;
    }
    */
}

class JobMiner extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobMiner'; }

    start_work(rm) {
	let d = this.d;
	let cr = Game.getObjectById(d.taken_by_id);
	let role = cr.memory.role;

	if(!d.res_id) {
	    if(d.res_pos) {
		let pos = rm.getPositionAt(d.res_pos.x, d.res_pos.y);
		let source = pos.findClosestByRange(FIND_SOURCES_ACTIVE);
		d.res_id = source.id;
	    }
	}
	
	role.workStatus = {
	    step: 0
	}
    }

    finish_work(rm) {
    }

    do_work(rm) {
	let d = this.d;
	let cr = Game.getObjectById(d.taken_by_id);
	let role = cr.memory.role;
	let res = Game.getObjectById(d.res_id);
	let drop = Game.getObjectById(d.drop_id);

	while( true ) {
	    if(role.workStatus.step === 0) {
		if(cr.pos.getRangeTo(res) > 1) {
		    cr.moveTo(res);
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 1) {
		cr.harvest(res);
		cr.drop(RESOURCE_ENERGY);
	    }
	}
	
    }    
}

class JobMinerBasic extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobMinerBasic'; }


    start_work(rm) {
	let d = this.d;
	let cr = Game.getObjectById(d.taken_by_id);
	let role = cr.memory.role;

	if(!d.drop_id) {
	    d.drop_id = Game.spawns[d.drop_name].id;
	}

	if(!d.res_id) {
	    if(d.res_pos) {
		let pos = rm.getPositionAt(d.res_pos.x, d.res_pos.y);
		let source = pos.findClosestByRange(FIND_SOURCES_ACTIVE);
		d.res_id = source.id;
	    }
	}
	
	role.workStatus = {
	    step: 0
	}
    }

    finish_work(rm) {
    }

    do_work(rm) {
	let d = this.d;
	let cr = Game.getObjectById(d.taken_by_id);
	let role = cr.memory.role;
	let res = Game.getObjectById(d.res_id);
	let drop = Game.getObjectById(d.drop_id);

	while( true ) {
	    if(role.workStatus.step === 0) {
		if(cr.pos.getRangeTo(res) > 1) {
		    cr.moveTo(res);
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 1) {
		if(cr.carry[RESOURCE_ENERGY] < cr.carryCapacity) {
		    cr.harvest(res);		
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 2) {
		if(cr.pos.getRangeTo(drop) > 1) {
		    cr.moveTo(drop);
		    break;
		} else {
		    role.workStatus.step++;		
		}
	    }

	    if(role.workStatus.step === 3) {
		if(cr.carry[RESOURCE_ENERGY] > 0) {
		    cr.transferEnergy(drop);
		    break;
		} else {
		    role.workStatus.step++;
		}	    
	    }
	    
	    if(role.workStatus.step === 4) {
		role.workStatus.step = 0;
	    }
	}
	
    }
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

    start_work(rm) {
	let d = this.d;
	let spawn = Game.getObjectById(d.taken_by_id);
	let role = spawn.memory.role;
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
	    role.workStatus = result;
	}
	else {
	    if( result !== d.workStatus) {
		console.log('Spawn error: '+result);
	    }
	    role.workStatus = result;
	}
    }

    finish_work(rm, success) {
	let d = this.d;
	let spawn = Game.getObjectById(d.taken_by_id);
	let role = spawn.memory.role;

	// update balance
	if(success) {
	    let cr = Game.creeps[role.workStatus];
	    rm.memory.creeplist[cr.name]={id: cr.id};
	    rm.memory.balance[d.bal_id].curCount++;
	} else {
	}
    }

    // todo - renew creeps
}

// class CCreep extends CMemObj {
//     constructor(d, parent) {
// 	super(d, parent);
// 	this.croom = this.parent.parent.rooms[d.id_room];
// 	this.role = f.make(d.role, this);
//     }
// }

var allClasses = [ Job, JobMiner, JobCarrier, JobSpawn, JobMinerBasic ];


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
	    // The spawn is not creating anything ...
	    
	    let job = lst[spawn.memory.role.job_id];

	    if(!job) {
		u.log("Job not found " + spawn.memory.role.job_id, u.LOG_ERR);
		spawn.memory.role.job_id = null;
		spawn.memory.role.workStatus = null;
	    } else {
		let cjob = f.make(job, null);

		// is the job done ?
		if(_.isString(spawn.memory.role.workStatus)) {

		    // release the job
		    u.log("Spawn " + spawn.name + " finished " + spawn.memory.role.job_id, u.LOG_INFO);

		    cjob.finish_work(spawn.room, true);

		    delete lst[spawn.memory.role.job_id];

		    spawn.memory.role.job_id = null;
		    spawn.memory.role.workStatus = null;
		} else {
		    // u.log("Spawn " + spawn.name + " waiting with status " + spawn.memory.role.workStatus, u.LOG_INFO);
		    cjob.start_work(spawn.room);
		    continue;
		}
	    }
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
	    cjob.start_work(spawn.room);

	    break;
	}
    }    
}

function detectRecoveryMode(rm) {
    rm.memory.recoveryMode = (rm.memory.balance.c1.curCount == 0) ? 1 : 0;
    if(rm.memory.recoveryMode) {
	u.log("Roome " + rm.name + " in RECOVERY MODE", u.LOG_WARN);
    }
}

function planCreepJobs() {
    for(let room_idx in Game.rooms) {
	let rm = Game.rooms[room_idx];

	if(!rm.memory.creeplist) continue;

	// Enable/disable the 'j1' job - JobMinerBasic
	//	if(rm.memory.balance.c1.curCount > 0) {
	if(!rm.memory.recoveryMode) {
	    if(!rm.memory.jobs.JobMiner.j1.onhold) {
		rm.memory.jobs.JobMiner.j1.onhold = {};
		let cjob = f.make(rm.memory.jobs.JobMiner.j1);
		cjob.unassign(rm);
	    }
	} else {
	    if(rm.memory.jobs.JobMiner.j1.onhold) {
		delete rm.memory.jobs.JobMiner.j1.onhold;
	    }
	}
    }    
}

function assignCreepJobs() {

    console.log('assignCreepJobs - entry');
    for(let room_idx in Game.rooms) {
	let rm = Game.rooms[room_idx];

	if(!rm.memory.creeplist) continue;

	for(let cr_name in rm.memory.creeplist) {
	    let cr = Game.getObjectById( rm.memory.creeplist[cr_name].id );
	    if(!cr) {
		u.log( "Creep " + cr_name + " is not found", u.LOG_INFO );
		
		// remove creep assignment
		if(Memory.creeps[cr_name]) {
		    if(Memory.creeps[cr_name].role) {
			let role = Memory.creeps[cr_name].role;
			if(role.job_id) {
			    let jobs = rm.memory.jobs[role.name];
			    let job = jobs[role.job_id];
			    job.taken_by_id = null;
			}
		    }
		    rm.memory.balance[Memory.creeps[cr_name].bal_id].curCount--;
		    delete Memory.creeps[cr_name];
		}
		
		delete rm.memory.creeplist[cr_name];
		continue;
	    }

	    if(cr.spawning)
		continue;

	    let role = cr.memory.role;
	    if(!role)
		continue;
	    let jobs = rm.memory.jobs[role.name];
	    if(!jobs) {
		u.log( "Creep " + cr_name + " has no job queue: " + role.name, u.LOG_INFO );
		continue;
	    }

	    if(role.job_id) {
		// already has a job
		let job = jobs[role.job_id];
		let cjob = f.make(job, null);
		
		cjob.do_work(rm);
		continue;
	    }

	    for(let job_id in jobs) {
		let job = jobs[job_id];
		if(job.taken_by_id != null)
		    continue;

		if(job.onhold)
		    continue;
		
		// found a job
		
		// take the job
		u.log("Creep " + cr.name + " takes " + job.id, u.LOG_INFO);
		role.job_id = job.id;
		job.taken_by_id = cr.id;

		// work on it
		let cjob = f.make(job, null);
		cjob.start_work(rm);
		cjob.do_work(rm);
		break;
	    }
	}
    }

    console.log('assignCreepJobs - exit');
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
	console.log('loop - entry');
	u.log('new tick');
	
	// collect stats
	myroom();

	detectRecoveryMode(Game.rooms['sim']);

	r.planSpawnJobs(Game.rooms['sim']);
	r.assignSpawnJobs();

	r.planCreepJobs();
	r.assignCreepJobs();

	// planGoals();

	// runGoals();

	console.log('loop - exit');
    },

    printAll : function() {
	u.printObject(glb);
    }
}
