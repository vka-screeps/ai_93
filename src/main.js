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
	    // u.log("Instantiating: " + d.cname, u.LOG_INFO); 
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

    getCount() {
	let d = this.d;
	return  (d.taken_by_id) ? (Object.keys(d.taken_by_id).length) : 0;
    }

    getCapacity() {
	let d = this.d;
	let capacity = defaultFor(d.capacity, 1);
	if(capacity === null) capacity = 1;
	return capacity;
    }

    isFull() {
	let d = this.d;
	let capacity = this.getCapacity();
	return (this.getCount() >= capacity);
    }

    getWorkers() {
	let d = this.d;	
	let ret = [];
	if(d.taken_by_id) {
	    Object.keys(d.taken_by_id).forEach(function(key) {
		let cr = Game.getObjectById(key);
		ret.push(cr);
	    } );
	}
	return ret;
    }

    // cr - optional
    unassign(rm, cr) {
	let d = this.d;
	if(d.taken_by_id) {

	    if(cr) {
		delete d.taken_by_id[cr.id];
		let role = cr.memory.role;
		role.job_id = null;
		role.workStatus = null;
	    } else {
		Object.keys(d.taken_by_id).forEach(function(key) {

		    let cr = Game.getObjectById(key);

		    if(cr) {
			let role = cr.memory.role;
			role.job_id = null;
			role.workStatus = null;
		    }
		    else {
			// find the creep's memory
			u.log( "Performance warning - Can't find creep with id - " + d.taken_by_id, u.LOG_WARN);

			// for(let nm in Memory.creeps) {
			// 	let role = Memory.creeps[nm].role;
			// 	if(role) {
			// 	    if(role.job_id === d.id) {
			// 		role.job_id = null;
			// 		role.workStatus = null;
			// 		break;
			// 	    }
			// 	}
			// }
		    }
		} );

		d.taken_by_id = null;
	    }
	}
    }

    assign(rm, cr) {
	let d = this.d;
	if(cr.memory.role.job_id != null) {
	    u.log( "Job.assign - creep already assigned " + cr.name, u.LOG_WARN);

	    let jobs = rm.memory.jobs[cr.memory.role.name];
	    if(jobs) {
		let job = jobs[cr.memory.role.job_id];
		if(job) {
		    let cjob = f.make(job);
		    cjob.unassign(rm, cr);
		}
	    }

	    cr.memory.role.job_id = null;
	    cr.memory.workStatus = null;
	}

	if(!d.taken_by_id) d.taken_by_id = {};
	d.taken_by_id[cr.id] = 1;
	cr.memory.role.job_id = d.id;

	u.log( "Job " + d.id + " assigned to " + cr.name );
    }

    do_work_all(rm) {
	let d = this.d;
	let obj = this;
	if(!d.taken_by_id)
	    return;
	Object.keys(d.taken_by_id).forEach(function(key) {
	    if(d.done) return;
	    if(d.onhold) return;
	    let cr = Game.getObjectById(key);
	    obj.do_work(rm, cr);
	} );
    }
}

class Addr extends CMemObj {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'Addr'; }

    init() {};
    move_to(cr, dist) { return true; }
    take(cr) { return true; }
    give(cr) { return true; }
}

function defaultFor(a, val) {
    return a = typeof a !== 'undefined' ? a : val;
}

class AddrPos extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrPos'; }

    init() { };

    getPos(rm) {
	let d = this.d;	
	return rm.getPositionAt(d.x, d.y);
    }

    move_to(cr, dist) {
	let d = this.d;
	dist = defaultFor(dist, defaultFor(d.dist, 1));
	if(cr.pos.getRangeTo(d.x, d.y) > dist) {
	    cr.moveTo(d.x, d.y);
	    return true;
	}
	return false;
    }
    
    take(cr) {
	let d = this.d;		
	if(d.full) {
	    if(cr.carry[RESOURCE_ENERGY] >= cr.carryCapacity)
		return false;
	} else {
	    if(cr.carry[RESOURCE_ENERGY] > 0)
		return false;
	}

	let rm = Game.rooms[cr.pos.roomName];
	let p = this.getPos(rm);
	// look for dropped energy
	{
	    let targets = p.findInRange(FIND_DROPPED_ENERGY, 3);
	    if(targets.length > 0) {
		let target = cr.pos.findClosestByRange(targets);
		if(cr.pos.getRangeTo(target)>1){
		    cr.moveTo(target);
		} else {
		    cr.pickup(target);
		}
		return true;
	    }
	}	
 
	return true;
    }
    
    give(cr) {
	u.log("AddrPos - cannot give " + cr.name, u.LOG_WARN);
	return false;
    }
}

class AddrHarvPoint extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrHarvPoint'; }

    init() { };

    getPos(rm) {
	let d = this.d;	
	return rm.getPositionAt(d.x, d.y);
    }    

    move_to(cr, dist) {
	dist = defaultFor(dist, 3);

	let d = this.d;
	if(cr.pos.getRangeTo(d.x, d.y) > dist) {
	    cr.moveTo(d.x, d.y);
	    return true;
	}
	return false;
    }
    
    take(cr) {
	let d = this.d;		
	if(d.full) {
	    if(cr.carry[RESOURCE_ENERGY] >= cr.carryCapacity)
		return false;
	} else {
	    if(cr.carry[RESOURCE_ENERGY] > 0)
		return false;
	}

	let rm = Game.rooms[cr.pos.roomName];
	let p = this.getPos(rm);
	// look for dropped energy
	{
	    let targets = p.findInRange(FIND_DROPPED_ENERGY, 2, {
		filter: function(o) {
		    return (o.energy>20);
		}
	    });
	    if(targets.length > 0) {
		let target = cr.pos.findClosestByRange(targets);
		if(cr.pos.getRangeTo(target)>1){
		    cr.moveTo(target);
		} else {
		    cr.pickup(target);
		}
		return true;
	    }
	}
	// look for containers
	{
	    let targets = p.findInRange(FIND_MY_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } });
	    if(targets.length > 0) {
		let target = cr.pos.findClosestByRange(targets);
		if(cr.pos.getRangeTo(target)>1){
		    cr.moveTo(target);
		} else {
		    target.transferEnergy(cr);
		}
		return true;
	    }
	}
	return true;
    }
    
    give(cr) {
	u.log("AddrHarvPoint - cannot give " + cr.name, u.LOG_WARN);
	return false;
    }
}

// class AddrHarvester extends Addr {
//     constructor(d, parent) {
// 	super(d, parent);
//     }

//     static cname() { return 'AddrHarvester'; }

//     init() { };

//     move_to(cr) {
// 	let d = this.d;
// 	if(cr.pos.getRangeTo(d.x, d.y) > 1) {
// 	    cr.moveTo(d.x, d.y);
// 	    return true;
// 	}
// 	return false;
//     }
    
//     take(cr) {
// 	let d = this.d;		
// 	if(d.full) {
// 	    if(cr.carry[RESOURCE_ENERGY] >= cr.carryCapacity)
// 		return false;
// 	} else {
// 	    if(cr.carry[RESOURCE_ENERGY] > 0)
// 		return false;
// 	}

// 	let target = cr.pos.findClosestByRange(FIND_DROPPED_ENERGY, { filter: function(o) { return cr.pos.getRangeTo(o.pos)<=2; } });
// 	if(target) {
// 	    cr.pickup(target);

// 	} 
// 	return true;
//     }
    
//     give(cr) {
// 	u.log("AddrHarvester - cannot give " + cr.name, u.LOG_WARN);
// 	return false;
//     }
// }

class AddrBuilding extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrBuilding'; }

    static create(tgt_id, parent) {
	return f.make( { cname: 'AddrBuilding',
			 tgt_id: tgt_id }, parent );
    }

    init() {
	let d = this.d;	
	if(!d.tgt_id) {
	    d.tgt_id = Game.spawns[d.spawnName].id;
	    d.isSpawn=1;
	}
    };

    getPos(rm) {
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);
	return tgt ? tgt.pos : null;
    }

    move_to(cr, dist) {
	dist = defaultFor(dist, 1);
	
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);
	if(tgt) {
	    if(cr.pos.getRangeTo(tgt) > dist) {
		cr.moveTo(tgt);
		return true;
	    }
	    return false;
	} else {
	    u.log("AddrBuilding - cannot find target " + d.tgt_id, u.LOG_WARN);
	    return true;
	}
    }
    
    take(cr) {
	if(cr.carry[RESOURCE_ENERGY] > 0)
	    return false;
	
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);	

	if(tgt) {
	    if( tgt.transferEnergy(cr) == ERR_NOT_IN_RANGE ) {
		cr.moveTo(tgt);
	    }
	} else {
	    u.log("AddrBuilding - cannot find target " + d.tgt_id, u.LOG_WARN);	    
	}
	return true;
    }
    
    give(cr) {
	if(cr.carry[RESOURCE_ENERGY] === 0)
	    return false;
	
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);	

	if(tgt) {
	    if( cr.transfer(tgt, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE ) {
		cr.moveTo(tgt);
	    }
	} else {
	    u.log("AddrBuilding - cannot find target " + d.tgt_id, u.LOG_WARN);	    
	}
	
	return true;
    }

    build(cr) {
	if(cr.carry[RESOURCE_ENERGY] === 0)
	    return false;
	
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);	

	if(tgt) {
	    let ret = 0;
	    if(tgt.structureType === STRUCTURE_CONTROLLER) {
		ret = cr.upgradeController(tgt);
	    } else {
		ret = cr.build(tgt);
	    }
	    if( ret == ERR_NOT_IN_RANGE ) {
		cr.moveTo(tgt);
	    } else if (ret == ERR_INVALID_TARGET) {
		let rm = Game.rooms[cr.pos.roomName];
		let cp = f.make(rm.memory.wait_point, null);
		cp.move_to(cr);
	    }
	    // todo - analyze error code
	} else {
	    u.log("AddrBuilding - cannot find target " + d.tgt_id, u.LOG_WARN);	    
	}
	
	return true;
    }

    exists() {
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);	
	return (tgt != null);
    }
}


class JobMiner extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobMiner'; }

    start_work(rm, cr) {
	let d = this.d;
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

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;
	let res = Game.getObjectById(d.res_id);
	// let drop = Game.getObjectById(d.drop_id);

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
		break;
	    }
	}
    }

}

class JobMinerBasic extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobMinerBasic'; }


    start_work(rm, cr) {
	let d = this.d;
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

    do_work(rm, cr) {
	let d = this.d;
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

    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	{
	    let tf = f.make(d.take_from);
	    tf.init();
	}
	{
	    let tt = f.make(d.take_to);
	    tt.init();
	}

	role.workStatus = {
	    step: 0
	}
    }

    finish_work(rm) {
    }

    findTarget(rm, cr) {
	var targets = rm.find(FIND_MY_SPAWNS, {				       
	    filter: function(o) { return o.energy < o.energyCapacity; } } );

	if(targets.length)
	    return targets[0];

	var target = cr.pos.findClosestByRange(FIND_MY_STRUCTURES, {
	    filter: function(o) { 
		return (o.structureType == STRUCTURE_EXTENSION) && o.energy < o.energyCapacity; } } );

	if(target)
	    return target;
	
	return null;
    }

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	while( true ) {
	    if(role.workStatus.step === 0) {
		let tf = f.make(d.take_from);
		if(tf.move_to(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 1) {
		let tf = f.make(d.take_from);
		if(tf.take(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    let tt = f.make(d.take_to);
	    if(tt.d.isSpawn) {
		if(cr.carry[RESOURCE_ENERGY] === 0) {
		    role.workStatus.step = 0;
		} else {
		    let tgt = this.findTarget(rm, cr);
		    if(tgt) {
			if( cr.transfer(tgt, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE ) {
			    cr.moveTo(tgt);
			}			
		    } else {
			// todo - go to the wait point
		    }
		    break;
		}
	    } else {
		if(role.workStatus.step === 2) {
		    if(tt.move_to(cr)) {
			break;
		    } else {
			role.workStatus.step++;
		    }
		}

		if(role.workStatus.step === 3) {
		    if(tt.give(cr)) {
			break;
		    } else {
			role.workStatus.step++;
		    }
		}
	    }
	    
	    if(role.workStatus.step === 4) {
		role.workStatus.step = 0;
	    }
	}
    }    
}

function helper_clone(o) {
    var newObj = {};

    Object.keys(o).forEach(function(key) {
	newObj[ key ] = o[ key ];
    });
    return newObj;
}

class JobBuilder extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobBuilder'; }


    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	role.workStatus = {
	    step: 0
	}

	let tfp = f.make(d.take_from).getPos(rm);
	let ttp = f.make(d.take_to).getPos(rm);

	console.log( 'path ' + tfp + ', ' + ttp + ', ' + tfp.findPathTo(ttp) );

	if(tfp && ttp && tfp.findPathTo(ttp).length > 10) {
	    // create JobSupplyBulder for this job
	    let car_jobs = rm.memory.jobs['JobCarrier'];
	    let car_job_id = 'help_' + d.id;
	    if(!car_jobs[car_job_id]) {
		let job = JobSupplyBulder.create(car_job_id, d, null);
		car_jobs[car_job_id] = job;
	    }
	}
    }

    finish_work(rm) {
	let d = this.d;
	
	d.done = true;
	this.unassign(rm);
    }


    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	while( true ) {

	    let tt = f.make(d.take_to);
	    if(!tt.exists())
	    {
		this.finish_work(rm);
		return;
	    }

	    let tf = f.make(d.take_from);
	    let car_jobs = rm.memory.jobs['JobCarrier'];
	    let car_job_id = 'help_' + d.id;
	    
	    if(car_jobs[car_job_id]) {
		let help_job = f.make(car_jobs[car_job_id], null);
		if(help_job.getCount() > 0) {
		    // someone is carrying resources
		    if(!d.take_from_local) {
			// save target pos into take_from_local
			let tgt = Game.getObjectById(d.take_to.tgt_id);
			if(tgt) {
			    let p = tgt.pos;
			    d.take_from_local = { cname: 'AddrPos',
						  x: p.x,
						  y: p.y,
						  dist: 3};
			    
			}
		    }
		    
		    tf = f.make(d.take_from_local);
		}
	    }
	    
	    if(role.workStatus.step === 0) {
		if(tf.move_to(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 1) {
		if(tf.take(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 2) {
		if(tt.move_to(cr,3)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 3) {
		if(tt.build(cr)) {
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

class JobSupplyBulder extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobSupplyBulder'; }

    static create(new_job_id, job_build, parent){
	return {
	    cname: 'JobSupplyBulder',
	    id: new_job_id,
	    taken_by_id: null,
	    capacity: job_build.capacity,
	    priority : job_build.priority,
	    take_from: job_build.take_from,
	    take_to: job_build.take_to,
	    main_job_id: job_build.id,
	};
    }
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	role.workStatus = {
	    step: 0
	}
    }

    finish_work(rm) {
	let d = this.d;
	
	d.done = true;
	this.unassign(rm);
    }

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	while( true ) {

	    let tt = f.make(d.take_to);
	    if(!tt.exists())
	    {
		this.finish_work(rm);
		return;
	    }
	    
	    if(role.workStatus.step === 0) {
		let tf = f.make(d.take_from);
		if(tf.move_to(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
		
	    }

	    if(role.workStatus.step === 1) {
		let tf = f.make(d.take_from);		
		if(tf.take(cr)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 2) {
		if(tt.move_to(cr, 2)) {
		    break;
		} else {
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 3) {

		if(cr.carry[RESOURCE_ENERGY] > 0) {
		    // cr.drop(RESOURCE_ENERGY);
		    let bld_jobs = rm.memory.jobs['JobBuilder'];
		    let wjob = bld_jobs[d.main_job_id];
		    if(!wjob) {
			u.log("JobSupplyBulder - Can't find job " + d.main_job_id, u.LOG_WARN);
			this.unassign(rm);
			return;
		    }
		    let cwjob = f.make(wjob, null);
		    let workersList = cwjob.getWorkers(); // list of creeps
		    if(!workersList || workersList.length == 0) {
			u.log("JobSupplyBulder - No workers at " + d.main_job_id, u.LOG_WARN);
			this.unassign(rm);
			return;
		    }

		    workersList = _.filter(workersList, function(c) {
			return ((c.carry[RESOURCE_ENERGY]+10) < c.carryCapacity);
		    } );

		    let tgt = cr.pos.findClosestByRange(workersList/*, { filter: function(c) {
			console.log(c.name + ' - ' + ((c.carry[RESOURCE_ENERGY]+30) < c.carryCapacity));
			return ((c.carry[RESOURCE_ENERGY]+30) < c.carryCapacity);
		    } }*/);

		    if(!tgt)
			break;
		    
		    // console.log('Select - ' + tgt.name + ', ' + tgt.carry[RESOURCE_ENERGY] + ', ' + tgt.carryCapacity);
		    
		    if(cr.pos.getRangeTo(tgt) > 7) {
			break; // too far
		    }
		    if( cr.transfer(tgt, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE ) {
			cr.moveTo(tgt);
		    }		    
		    
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


class JobDefender extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobDefender'; }

    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	{
	    let tf = f.make(d.def_pos);
	    tf.init();
	}

	role.workStatus = {
	    step: 0
	}
    }

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;
	
	let tgt = cr.pos.findInRange(FIND_HOSTILE_CREEPS, 1);
	if(tgt.length > 0) {
	    cr.attack(tgt[0]);
	} else {
	    let def_pos = cr.pos;
	    tgt = def_pos.findInRange(FIND_HOSTILE_CREEPS, 3);
	    if(tgt.length>0) {
		cr.moveTo(tgt[0]);
	    } else {
		let def_pos = rm.getPositionAt(d.def_pos.x, d.def_pos.y);
		tgt = def_pos.findInRange(FIND_HOSTILE_CREEPS, 10);
		if(tgt.length>0) {
		    cr.moveTo(tgt[0]);
		} else {
		    if(cr.pos.getRangeTo(def_pos) > 0) {
			cr.moveTo(def_pos);
		    } else {
		    }
		}
	    }
	}
    }    
}

var designRegistry = {
    'd_h0' : [ WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, ],    
    'd_h1' : [ WORK, WORK, CARRY, MOVE, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, ],
    //    'd_c1' : [ CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE ],
    'd_c1' : [ CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE ],
    // builder
    'd_b1' : [ WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK ],
    // slow builder
    'd_b2' : [ WORK, CARRY, MOVE, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK ],    
    'd_def1' : [ TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, ]
};

var costRegistry = {
    move: 50,
    work: 100,
    carry: 50,
    attack: 80,
    ranged_attack: 150,
    heal: 250,
    claim: 600,
    tough: 10
}

function getDesign( design, sp, rm ) {

    if(rm.memory.recoveryMode) {
	if(design == 'd_h1') {
	    return [WORK, CARRY, MOVE];
	} else if (design == 'd_c1') {
	    return [CARRY, CARRY, MOVE];
	} 
    }

    let energy = rm.energyCapacityAvailable;
    
    let proto = designRegistry[design];
    if(!proto) {
	u.log("Can't find design: " + design, u.LOG_WARN);
	return [WORK, WORK, CARRY, MOVE];	
    }

    let i=0;
    let cost = 0;
    let ret = [ ];
    while(cost < energy) {
	let next =  proto[i++];
	if(!next)
	    break;

	cost = cost + costRegistry[next];
	
	if(cost > energy)
	    break;

	if(next === TOUGH) {
	    ret = [TOUGH].concat(ret);
	} else {
	    ret.push(next);
	}
    }

    u.log("Design for " + design + " - " + ret, u.LOG_INFO);
    
    return ret;
}

class JobSpawn extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobSpawn'; }

    start_work(rm, spawn) {
	let d = this.d;
	let role = spawn.memory.role;
	role.workStatus = null;
    }

    do_work(rm, spawn) {
	if(spawn.spawning != null)
	    return;

	let d = this.d;
	let role = spawn.memory.role;
	if(role.workStatus === null) {
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
	    role.workStatus = result;
	    
	    if(_.isString(result)) {
		console.log('The name is: '+result);
	    }
	    else {
		this.finish_work(rm, spawn, false);
		// if( result !== d.workStatus) {
		// 	console.log('Spawn error: '+result);
		// }
		// role.workStatus = result;
	    }
	} else {
	    this.finish_work(rm, spawn, true);
	}
	
	// this.finish_work(rm, spawn, true);
    }

    finish_work(rm, spawn, success) {
	let d = this.d;
	let role = spawn.memory.role;

	// update balance
	if(success) {
	    let cr = Game.creeps[role.workStatus];
	    rm.memory.creeplist[cr.name]={id: cr.id};
	    rm.memory.balance[d.bal_id].curCount++;
	    d.capacity--;
	    if(d.capacity < 0)
		d.capacity = 0;
	    this.unassign(rm, spawn);
	} else {
	    this.unassign(rm, spawn);
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

var allClasses = [ Job, JobMiner, JobCarrier, JobSpawn, JobMinerBasic, JobDefender, Addr, AddrBuilding, AddrPos, JobBuilder, AddrHarvPoint, JobSupplyBulder ];


///////////////////////////////////////////////////////


// Convert balance into JobSpawn jobs
function planSpawnJobs(rm) {
    let jobs = rm.memory.jobs;
    if (!jobs['JobSpawn']) jobs['JobSpawn'] = {};
    let lst = jobs['JobSpawn'];

    let priority = 0;
    for(let i in rm.memory.balance) {
	let bal_ln = rm.memory.balance[i];
	priority++;

	let job_id = bal_ln.id;
	let job = lst[job_id];
	let countInProgress = job ? job.capacity : 0;
	
	if(bal_ln.count > bal_ln.curCount + countInProgress) {
	    if(!lst[job_id]) {
		let new_job = {
		    cname: 'JobSpawn',
		    id: job_id,
		    taken_by_id: null,
		    capacity: (bal_ln.count - bal_ln.curCount),
		    bal_id: bal_ln.id,
		    priority: priority,
		    design: bal_ln.design
		};

		u.log("New JobSpawn: " + job_id, u.LOG_INFO);
		lst[job_id] = new_job;
	    } else {
		job.capacity = bal_ln.count - bal_ln.curCount;
		if (job.capacity<0)
		    job.capacity = 0;
	    }
	} else if (bal_ln.count < bal_ln.curCount + countInProgress) {
	    if(job) {
		job.capacity = bal_ln.count - bal_ln.curCount;
		if (job.capacity<0)
		    job.capacity = 0;
	    }
	}
    }
}

function assignSpawnJobs(rm) {
    let spawns = rm.find(FIND_MY_SPAWNS);
    
    for(let i1 in spawns) {
	let spawn = spawns[i1];

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
		continue; // work in progress
	    }
		/* else {
		let cjob = f.make(job, null);

		// TODO: just in case, they are out of sync
		// job.taken_by_id = spawn.id;

		// is the job done ?
		if(_.isString(spawn.memory.role.workStatus)) {

		    // release the job
		    u.log("Spawn " + spawn.name + " finished " + spawn.memory.role.job_id, u.LOG_INFO);

		    cjob.finish_work(spawn.room, spawn, true);

		    // delete lst[spawn.memory.role.job_id];
		    // spawn.memory.role.job_id = null;
		    // spawn.memory.role.workStatus = null;
		} else {
		    // u.log("Spawn " + spawn.name + " waiting with status " + spawn.memory.role.workStatus, u.LOG_INFO);
		    // cjob.start_work(spawn.room, spawn);
		    continue;
		}
	    } */
	}

	for(let i2 in lst) {
	    let job = lst[i2];
	    let cjob = f.make(job, null);

	    if(cjob.getCount()>0)
		continue;

	    if(cjob.getCapacity() == 0)
		continue;

	    // take the job
	    // u.log("Spawn " + spawn.name + " takes " + job.id, u.LOG_INFO);
	    // spawn.memory.role.job_id = job.id;
	    // job.taken_by_id = spawn.id;
	    cjob.assign(rm, spawn);

	    // work on it
	    cjob.start_work(spawn.room, spawn);

	    break;
	}
    }
}

function detectRecoveryMode(rm) {
    rm.memory.recoveryMode = (rm.memory.balance.c1.curCount + rm.memory.balance.c2.curCount == 0) ? 1 : 0;
    if(rm.memory.recoveryMode) {
	u.log("Roome " + rm.name + " in RECOVERY MODE", u.LOG_WARN);
    }
}

function nextTickPlanning(rm) {
    // increase defenders count, based on the number of defence jobs

    // increase builder's count, based on the number of defence jobs
    /*
    if(!rm.memory.creeplist) return;

    for(let cr_name in rm.memory.creeplist) {
	let cr = Game.getObjectById( rm.memory.creeplist[cr_name].id );
    }
    */
    {
	let jobs = rm.memory.jobs.JobBuilder;
	if(jobs) {
	    let jobs_cnt = 0;
	    Object.keys(jobs).forEach(function(key) {
		let cjob = f.make(jobs[key], null);
		jobs_cnt += cjob.getCapacity();
	    });
	    // jobs_cnt = jobs_cnt/2;
	    if(jobs_cnt>5)
		jobs_cnt = 5;
	    rm.memory.balance.b1.count = jobs_cnt;
	}
    }

    {
	let jobs = rm.memory.jobs.JobCarrier;
	if(jobs) {
	    let jobs_cnt = Object.keys(jobs).length;
	    rm.memory.balance.c2.count = jobs_cnt;
	}
    }
}

function getConstrBuildingCapacity(rm, con) {
    if(con.structureType === STRUCTURE_CONTROLLER ||
       con.structureType === STRUCTURE_ROAD) {
	return 1;
    }
    return 2;
}

// Put the JobMinerBasic on hold, after leaving the recovery mode
function planCreepJobs(rm) {
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

    if(!rm.memory.jobs.JobBuilder['ctrlr']) {
	let ctrlrs = rm.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_CONTROLLER } });
	if(ctrlrs.length > 0) {
	    let con = ctrlrs[0];
	    let con_job_id = 'ctrlr';
	    if(!rm.memory.jobs.JobBuilder[con_job_id]) {
		let job = { id: con_job_id,
			    cname: 'JobBuilder',
			    taken_by_id: null,
			    priority : 0,
			    take_from: rm.memory.harv_point,
			    take_to: { cname: 'AddrBuilding',
				       tgt_id: con.id },
			  };

		rm.memory.jobs.JobBuilder[con_job_id] = job;
	    }
	}
    }

    let con_lst = rm.find(FIND_MY_CONSTRUCTION_SITES);
    for(let con_i in con_lst) {
	let con = con_lst[con_i];
	let con_capacity = getConstrBuildingCapacity(rm, con);
	let con_job_id = 'con_' + con.id;
	if(!rm.memory.jobs.JobBuilder[con_job_id]) {
	    let job = { id: con_job_id,
			cname: 'JobBuilder',
			taken_by_id: null,
			capacity: con_capacity,
			priority : 0,
			take_from: rm.memory.harv_point,
			take_to: { cname: 'AddrBuilding',
				   tgt_id: con.id },
		      };

	    rm.memory.jobs.JobBuilder[con_job_id] = job;
	}
    }
}

function cleanUpDeadCreeps(rm) {

    for(let cr_name in rm.memory.creeplist) {
	let cr_id = rm.memory.creeplist[cr_name].id;
	let cr = Game.getObjectById(cr_id);
	if(!cr) {
	    u.log( "Creep " + cr_name + " is not found", u.LOG_INFO );
	    
	    // remove creep assignment
	    if(Memory.creeps[cr_name]) {
		if(Memory.creeps[cr_name].role) {
		    let role = Memory.creeps[cr_name].role;
		    if(role.job_id) {
			let jobs = rm.memory.jobs[role.name];
			let job = jobs[role.job_id];
			if(job.taken_by_id){
			    delete job.taken_by_id[cr_id];
			}
		    }
		}
		rm.memory.balance[Memory.creeps[cr_name].bal_id].curCount--;
		delete Memory.creeps[cr_name];
	    }
	    
	    delete rm.memory.creeplist[cr_name];
	}
    }
}

// 1. Unassign and remove creeps that no longer exist
// 2. If already has a job - do_work()
// 3. Assign a new job, otherwise - start_work(), do_work()
function assignCreepJobs(rm) {

    // for(let room_idx in Game.rooms) {
    // 	let rm = Game.rooms[room_idx];

    let cwait_poit = f.make(rm.memory.wait_point, null);

    for(let cr_name in rm.memory.creeplist) {
	let cr = Game.getObjectById( rm.memory.creeplist[cr_name].id );

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
	    // let job = jobs[role.job_id];
	    // let cjob = f.make(job, null);
	    
	    // cjob.do_work(rm);
	    continue;
	}

	// TODO: don't start over again and again, use Object.keys(jobs)
	for(let job_id in jobs) {
	    let job = jobs[job_id];
	    let cjob = f.make(job, null);

	    if(job.done) {
		cjob.unassign(rm);
		delete jobs[job_id];
		continue;
	    }
	    if(job.onhold)
		continue;
	    
	    if(cjob.isFull())
		continue;
	    
	    // found a job
	    
	    // take the job
	    cjob.assign(rm, cr);

	    // work on it
	    cjob.start_work(rm, cr);
	    // cjob.do_work(rm);
	    break;
	}

	if(!role.job_id) {
	    // no job - move to wait_point
	    cwait_poit.move_to(cr);
	}
    }
    //    }
}

function doAllJobs(rm) {
    for(let role_name in rm.memory.jobs) {
	let jobs = rm.memory.jobs[role_name];
	for(let job_id in jobs) {
	    let job = jobs[job_id];
	    let cjob = f.make(job, null);
	    cjob.do_work_all(rm);
	}
    }
}

function processRoom(rm) {
    if(!rm.memory.creeplist)
	return;

    cleanUpDeadCreeps(rm);
    detectRecoveryMode(rm);
    
    planCreepJobs(rm); // new jobs for builders
    nextTickPlanning(rm); // adjust the number of creeps on the balance

    planSpawnJobs(rm);  // // Convert balance into JobSpawn jobs
    assignSpawnJobs(rm);
    assignCreepJobs(rm);
    doAllJobs(rm);
}


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
	u.log('new tick:' + Game.time);
	
	// collect stats
	myroom();

	processRoom(Game.rooms['sim']);

	/*
	detectRecoveryMode(Game.rooms['sim']);

	r.planSpawnJobs(Game.rooms['sim']);
	r.assignSpawnJobs();

	r.planCreepJobs();
	r.assignCreepJobs();
	*/
	// planGoals();

	// runGoals();
    },

    printAll : function() {
	u.printObject(glb);
    },

    clearJobs: function() {
	
    }
}
