// module.exports = {
//     transferCreepToRoom : function(crName, rmName) { transferCreepToRoom(crName, rmName); },
// }

var memobj = require('memobj')();
var f = memobj.f;
var CMemObj = memobj.CMemObj;

var task = require('task')(memobj);

var u = require('utils');
var _ = require('lodash');
var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var config = require('config');


//var stat = require('stat');
//var r = require('roles');

var jobTypes = []; // populated by the initRoomTables() method

var jobPriorities = {
    mining: 0,
    jc1: 1,
    tower_refill: 50,
    scavenge : 100,
    upkeep: 110,
    build: 210,
    ctrlr: 310,
    claim : 1000,
    waiting: 1000000,
}

var r = {
    init: function() { m_init() },
    f : f,
    planSpawnJobs : planSpawnJobs,
    assignSpawnJobs : assignSpawnJobs,
    
    planCreepJobs : planCreepJobs,
    assignCreepJobs : assignCreepJobs,
}


function m_init() {
    memobj.regClasses(allClasses);
}

class TaskClaim extends task.Task {
    constructor(d, parent) {
	super(d, parent);
    }
    
    static cname() { return 'TaskClaim'; }

    get_cur_jobs(rm) {
	let d = this.d;
	if(d.job_lst)
	    return d.job_lst;
	d.job_lst = [ {job_type: 'JobClaim',
		       job_id: 'claim_task_' + d.id,
		       done: false } ];

	// console.log( 'get_cur_jobs returns ' + this.job_lst + ', ' + this.job_lst.length);
	return d.job_lst;
    }

};

class TaskMining extends task.Task {
    constructor(d, parent) {
	super(d, parent);
    }
    
    static cname() { return 'TaskMining'; }

    get_cur_jobs(rm) {
	let d = this.d;
	if(d.job_lst)
	    return d.job_lst;
	d.job_lst = [ {job_type: 'JobMiner',
		       job_id: 'harv_' + d.id,
		       done: false },
		      {job_type: 'JobCarrier',
		       job_id: 'carry_harv_' + d.id,
		       done: false }
		    ];

	// console.log( 'get_cur_jobs returns ' + this.job_lst + ', ' + this.job_lst.length);
	return d.job_lst;
    }

    maybeUpdateJob(rm) {
	let d = this.d;
	try {
	    let job = this.getJob(rm, this.get_cur_jobs(rm)[0]);
	    if(job) {
		job.maxCapacity = d.maxCapacity;
		job.priority = d.priority;
		job.mayDrop = d.mayDrop;
		job.autoContainers = d.autoContainers;
	    }
	} catch(err) {console.log(err);}
	
	try {
	    let job = this.getJob(rm, this.get_cur_jobs(rm)[1]);
	    if(job) {
		job.priority = d.priority;
		job.extraCapacity = d.extraCapacity;
		f.make(job,null).calcPower();
	    }
	} catch(err) {console.log(err);}
    }
};

class TaskConstr extends task.Task {
    constructor(d, parent) {
	super(d, parent);
    }
    
    static cname() { return 'TaskConstr'; }

    maybeWorkOnTask(rm){
	let d = this.d;
	if(d.complete)
	    return;

	let p = f.make(d.pts[0], null);
	let rm2 = Game.rooms[p.d.roomName];
	if(rm2) {

	    let status = rm2.createConstructionSite(p.d.x, p.d.y, d.type);
	    if(status == OK) {
		u.log( 'Created construction site ' + d.type, u.LOG_INFO );
		d.complete = true;
	    }
	}
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

    getPriority() {
	let d = this.d;
	return defaultFor(d.priority, 10000);
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

    getFirstWorkerId() {
	let d = this.d;	
	
	if(d.taken_by_id) {
	    let keys = Object.keys(d.taken_by_id);
	    if(keys.length>0)
		return keys[0];
	}
	return null;
    }

    moveWorkerToEndOfLine(rm, cr) {
	try {
	    let d = this.d;
	    let keys = Object.keys(d.taken_by_id);
	    if(d.taken_by_id[cr.id]) {
		d.taken_by_id[cr.id] = _.max( _.map( keys, (k)=>{return d.taken_by_id[k];} ) ) + 1;
	    } else {
		throw ("creep not assigned to this job");
	    }
	    
	} catch(err) {
	    u.log('Error in moveWorkerToEndOfLine - ' + err, u.LOG_ERR );
	}
    }

    calcCreepPwr(rm, cr) {
	return 1;
    }


    getHelperJob(rm) {
	let d = this.d;
	return null;
    }


    setHelperQuota(rm, qta) {
	u.log( "setHelperQuota is not implemented", u.LOG_WARN);
    }

    getLimitedCurPower(qta) {
	return qta;
    }

    calcPower(rm) {
	let d = this.d;
	let this_ = this;	
	d.curPower = 0;
	let extraCapacity = defaultFor(d.extraCapacity, 0);

	this.forEachWorker(rm, function(rm, cr) {
	    if(extraCapacity) {
		--extraCapacity;
	    } else {
		d.curPower += this_.calcCreepPwr(rm, cr);
	    }
	} );

	let cjob2 = (function(rm) { return this_.getHelperJob(rm); })(rm);
	let qta2 = (function() { return this_.getLimitedCurPower(d.curPower); })();

	if(d.reqQta && qta2 > d.reqQta)
	    qta2 = d.reqQta;

	if(cjob2) {
	    cjob2.setHelperQuota(rm, qta2);
	}
    }
    

    updateCapacity(rm) {
	let d = this.d;
	
	if(!d.curPower) {
	    d.curPower = 0;
	}

	this.calcPower(rm); // this should update the helper job quota
	
	if(!d.reqQta) {
	    this.unassign(rm);
	    d.capacity = 0;
	} else {
	    // getCount, reqQta, workRate
	    if(this.getCount() === this.getCapacity()) {
		if(d.curPower < 0.95 * d.reqQta) {
		    d.capacity ++;
		}
	    }

	    if( (this.getCount() > 0) &&
		(this.getCount() <= this.getCapacity()) &&
		(d.curPower > 1.1 * d.reqQta)) {
		let cr_id = this.getFirstWorkerId();
		let cr = Game.getObjectById(cr_id);
		// let cr_pwr = cr.memory.design[WORK] * d.workRate;
		let this_ = this;
		let cr_pwr = (function(){return this_.calcCreepPwr(rm, cr);}) ();
		// console.log('updateCapacity - '+d.reqQta +', '+d.curPower +', '+ cr_pwr);
		if((d.curPower - cr_pwr) > (1.1 * d.reqQta)) {
		    this.unassign(rm, cr);
		    d.capacity--;
		}
	    }
	}
	if( typeof d.maxCapacity !== 'undefined' ) {
	    if(d.capacity>d.maxCapacity) {
		d.capacity = d.maxCapacity;
	    }
	}
    }    

    // cr - optional
    unassign(rm, cr) {
	let d = this.d;
	if(d.taken_by_id) {

	    if(cr) {
		// u.log( "Unassign creep " + cr.name + ' from ' + d.id, u.LOG_INFO );
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

	this.calcPower(rm);
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

	this.calcPower(rm);
	u.log( "Job " + d.id + " assigned to " + cr.name + ', priority=' + d.priority, u.LOG_DBG );
    }

    forEachWorker(rm, f) {
	let d = this.d;
	
	if(d.taken_by_id) {
	    Object.keys(d.taken_by_id).forEach(function(key) {
		let cr = Game.getObjectById(key);
		f(rm, cr);
	    } );
	}	
    }

    do_work_all(rm) {
	let d = this.d;
	let obj = this;
	if(!d.taken_by_id)
	    return;
	let keys = Object.keys(d.taken_by_id);
	keys = _.sortBy(keys, function(k) {
	    return defaultFor( d.taken_by_id[k], 0);
	} );
	    
	keys.forEach(function(key) {
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
    exists() { return true; }
}

function defaultFor(a, val) {
    return a = typeof a !== 'undefined' ? a : val;
}

function creepIsFull(cr) {
    let total = _.sum(cr.carry);
    return total >= cr.carryCapacity;
}

function creepFullPct(cr) {
    let total = _.sum(cr.carry);
    return cr.carryCapacity ? (total/cr.carryCapacity) : 0;
}

function creepIsFullWith(cr, res) {
    let total = cr.carry[res] ? cr.carry[res] : 0;
    return total >= cr.carryCapacity;
}

function creepIsFilledWithAny(cr) {
    let total = _.sum(cr.carry);
    return total > 0;
}

function creepIsFilledWithAnyBut(cr, res) {
    let total = _.sum(cr.carry);
    total -= cr.carry[res] ? cr.carry[res] : 0;
    return total > 0;
}

function creepIsFilledWith(cr, res) {
    return cr.carry[res] && (cr.carry[res] > 0);
}

function getRoomSpawnName(rm) {
    let spawns = rm.find(FIND_MY_SPAWNS);
    if(spawns && spawns.length)
	return spawns[0].name;
    return null;
}


class AddrPos extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrPos'; }

    init() { };

    getPos(rm) {
	let d = this.d;
	return new RoomPosition(d.x, d.y, d.roomName);
	// rm = Game.rooms[d.roomName];
	// return rm.getPositionAt(d.x, d.y);
    }
    
    // getPos(rm) {
    // 	let d = this.d;
    // 	if(!rm) {
    // 	    rm = Game.rooms[d.roomName];
    // 	}
    // 	return rm.getPositionAt(d.x, d.y);
    // }

    move_to(cr, dist) {
	let d = this.d;

	if(cr.pos.roomName !== d.roomName) {
	    // console.log( 'Creep ' + cr.name + ' moves to room ' + d.roomName );
	    cr.moveTo(this.getPos());
	    return true;
	}
	
	dist = defaultFor(dist, defaultFor(d.dist, 1));
	if(cr.pos.getRangeTo(d.x, d.y) > dist) {
	    cr.moveTo(d.x, d.y);
	    return true;
	}
	return false;
    }
    
    take(cr) {
	let d = this.d;
	if (d.isWaitPoint) {
	    if(creepIsFilledWithAny(cr)) {
		return false; // already have got some energy here
	    } else {
		if(cr.pos.getRangeTo(this.getPos()) > 1) {
		    // cr.moveTo(d.x, d.y);
		    cr.moveTo(this.getPos());
		}		
		return true; // keep waiting
	    }
	}
	if(d.full) {
	    if(creepIsFull(cr))
		return false;
	} else {
	    if(creepIsFilledWithAny(cr))
		return false;
	}

	// let rm = Game.rooms[cr.pos.roomName];
	let rm = Game.rooms[d.roomName];
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
	    } else {
		let dist = 3;
		if(cr.pos.getRangeTo(d.x, d.y) > dist) {
		    cr.moveTo(d.x, d.y);
		}
	    }
	}	
 
	return true;
    }
    
    give(cr) {
	u.log("AddrPos - cannot give " + cr.name, u.LOG_WARN);
	return false;
    }
}

// Room for scavenging
class AddrFreeRoom extends AddrPos {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrFreeRoom'; }

    doWithdraw(cr, tgt, res) {
	let status = cr.withdraw(tgt, res);
	if(status == OK || status == ERR_FULL) {
	    return 1;
	} else if (status == ERR_NOT_ENOUGH_RESOURCES) {
	    return 0;
	} else if (status == ERR_NOT_IN_RANGE) {
	    status = cr.moveTo(tgt);
	    if(status == OK || status == ERR_TIRED) {
		return 1;
	    } else {
		return -1;
	    }
	} else {
	    return -1;
	}
    }

    take(cr) {
	let d = this.d;
	if(d.full) {
	    if(creepIsFull(cr))
		return false;
	} else {
	    if(creepIsFilledWithAny(cr))
		return false;
	}

	if(cr.pos.roomName !== d.roomName) {
	    // console.log( 'Creep ' + cr.name + ' moves to room ' + d.roomName );
	    cr.moveTo(this.getPos());
	    return true;
	}

	if(d.done) {
	    return false;
	}

	/*
	if(this.move_to(cr, 3)) {
	    return true;
	}
	*/

	// let rm = Game.rooms[cr.pos.roomName];
	let rm = Game.rooms[d.roomName];
	let p = this.getPos(rm);
	if(!d.target_list || (d.target_list.length==0)) {
	    console.log('creating target list');
	    let targets = rm.find(FIND_STRUCTURES, {
		filter: function(struct) {
		    let isGood = false;
		    try {
			if(!struct.my) {
			    let total = 0;
			    if(struct.energy) {
				total += struct.energy;
			    }
			    if(struct.store) {
				total += _.sum(struct.store);
			    }
			    if(total>0) {
				isGood = true;
			    }
			}
		    } catch (err) {
		    }
		    return isGood;
		}
	    });

	    _.sortBy(targets, function(struct) {
		return p.getRangeTo(struct);
	    } );

	    d.target_list = _.map(targets, function (struct) {
		let retVal = {
		    id: struct.id,
		    store: {}
		};

		if(struct.energy && struct.energy > 0) {
		    retVal.store[RESOURCE_ENERGY] = struct.energy;
		}

		if(struct.store) {
		    // for(let res in struct.store) {
		    // 	struct.store[res] = struct.store[res];
		    // }
		    retVal.store = struct.store;
		}
		return retVal;
	    });
	}

	if(d.target_list.length==0) {
	    d.done = true;
	    return false;
	}

	// u.log( 'Creep ' + cr.name + ' scavenging in room ' + rm.name, u.LOG_INFO );
	let tgt = null;
	let res = null;
	let foundSome = false;
	let limit = 50;
	while(limit-- > 0 && d.target_list.length > 0) {
	    tgt = d.target_list[0];
	    let resTypes = Object.keys(tgt.store);
	    while(resTypes.length > 0) {
		let res = resTypes[0];

		// try to withdraw
		let withdrawRet = this.doWithdraw(cr, Game.getObjectById(tgt.id), res);
		// console.log('Creep ' + cr.name + ' withdrawing ' + res + ' from ' + tgt.id + ' status: ' + withdrawRet );

		if(withdrawRet>0) {
		    foundSome = true;
		    break;
		} else if(withdrawRet==0) {
		    // done with this res
		    resTypes.splice(0, 1);
		    delete tgt.store[res];
		} else {
		    // done with this target
		    delete tgt.store;
		    break;
		}
	    }

	    if(!tgt.store || Object.keys(tgt.store).length == 0/* || !foundSome*/) {
		d.target_list.splice(0, 1);
	    }

	    if(foundSome)
		break;
	}

	return foundSome;
    }

    exists() {
	return this.d.done ? false : true;
    }
}

class AddrStoragePoint extends AddrPos {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrStoragePoint'; }

    init() { };

    giveAllRes(cr, tgt) {
	let status = OK;
 	for(let resourceType in cr.carry) {
	    if(cr.carry[resourceType] > 0) {
		status = cr.transfer(tgt, resourceType);
	    }
	}
	return status;
    }

    giveAllResBut(cr, tgt, res) {
	let status = OK;
 	for(let resourceType in cr.carry) {
	    if(resourceType !== res)
	    {
		if(cr.carry[resourceType] > 0) {
		    status = cr.transfer(tgt, resourceType);
		}
	    }
	}
	return status;
    }    

    take(cr) {
	let d = this.d;		
	if(d.full) {
	    if(creepIsFullWith(cr, RESOURCE_ENERGY))
		return false;
	} else {
	    if(creepIsFilledWith(cr, RESOURCE_ENERGY))
		return false;
	}

	let threshold = 500;
	let cjob = getCreepsJob(cr);
	if(cjob && cjob.d.priority < 10) {
	    threshold = 0;
	}

	if(this.getAmount() >= threshold) {
	    if((this.getTotalCapacity() > 0 || d.isActive) && this.getAmount()>0) {

		if(this.move_to(cr, 3)) {
		    return true;
		}

		let rm = Game.rooms[d.roomName];
		let p = this.getPos(rm);

		// give up resources
		if(creepIsFilledWithAnyBut(cr, RESOURCE_ENERGY))
		{
		    let tgt1 = _.find(d.containers, function(o) { return !o.isFull } );
		    if(tgt1) {
			let tgt = Game.getObjectById(tgt1.id);
			let status = this.giveAllResBut(cr, tgt, RESOURCE_ENERGY);
			if(status  == ERR_NOT_IN_RANGE ) {
			    cr.moveTo(tgt);
			    return true;
			}  else if (status == OK) {
			    return true;
			} else {
			    u.log('Error - has no resources to give up' + cr.name + ' status ' + status, u.LOG_ERR);
			}
		    }		    
		}
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
		    } else {
			let tgt1 = _.find(d.containers, function(o) { return o.energy>0; });
			if(tgt1) {
			    let tgt = Game.getObjectById(tgt1.id);
			    if( tgt.transfer(cr, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE ) {
				cr.moveTo(tgt);
			    }			    
			}
		    }
		}	
		
		return true;
	    } else {
		// use backup position
		let cbackup = f.make(d.backup_point, null);
		return cbackup.take(cr);
	    }
	} else {
	    let rm = Game.rooms[d.roomName];
	    let cp = f.make(rm.memory.wait_point, null);
	    cp.move_to(cr);
	    return true; 
	}
    }

    
    give(cr) {
	let d = this.d;

	if(!creepIsFilledWithAny(cr))
	    return false;

	this.getAmount(); // refresh cash data

	let tgt1 = _.find(d.containers, {isFull: false});
	if(tgt1) {
	    let tgt = Game.getObjectById(tgt1.id);
	    // let status = cr.transfer(tgt, RESOURCE_ENERGY);
	    // transfer all resources
	    let status = this.giveAllRes(cr, tgt);
	    // console.log( "transfer = " + tgt.id + status );
	    if(status == ERR_NOT_IN_RANGE ) {
		cr.moveTo(tgt);
		return true;
	    }
	    d.isActive = true;
	} else {
	    if(this.move_to(cr, 0)) {
		return true;
	    }

	    cr.drop(RESOURCE_ENERGY);
	    d.isActive = true;
	    return true; // Don't return false. Even though can move the same turn, it must be empty.
	}
	
	return true;
    }

    getAmount() {
	let d = this.d;		

	let rm = Game.rooms[d.roomName];
	let p = this.getPos(rm);

	if(!d.updTime || (Game.time != d.updTime)) {
	    // calculate amount
	    d.updTime = Game.time;
	    let energy = 0;
	    let targets = p.findInRange(FIND_DROPPED_ENERGY, 0);
	    if(targets.length > 0) {
		targets.forEach(function(e) { energy += e.energy } );
	    }
	    d.containers = {};
	    let containers = {};
	    d.totalCapacity = 0;
	    {

		{
		    // let targets = p.findInRange(FIND_STRUCTURES, 1 ,{ filter: { structureType: STRUCTURE_CONTAINER }} );
		    let targets = p.findInRange(FIND_STRUCTURES, 2, {filter: function(o) {
			return (o.structureType===STRUCTURE_CONTAINER) || (o.structureType===STRUCTURE_STORAGE);
		    }} );
		    if(targets.length > 0) {
			targets.forEach(function(c) {
			    let e = c.store[RESOURCE_ENERGY];
			    containers[c.id] = { id: c.id,
						 energy: e,
						 isFull: _.sum(c.store) >= c.storeCapacity
					       };
			    energy+= e;
			    d.totalCapacity += c.storeCapacity;
			} );
		    };
		}
	    }
	    d.containers = containers;
	    d.energy = energy;
	}

	return d.energy;
    }

    getTotalCapacity() {
	this.getAmount();
	return this.d.totalCapacity;
    }

    
}

class AddrHarvPoint extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrHarvPoint'; }

    init() {
	let d = this.d;		
	if(!d.res_id) {
	    // let pos = rm.getPositionAt(d.res_pos.x, d.res_pos.y);
	    let rm = Game.rooms[d.roomName];
	    let pos = this.getPos(rm);
	    let source = pos.findClosestByRange(FIND_SOURCES);
	    d.res_id = source.id;
	}
    };

    getPos(rm) {
	let d = this.d;
	return new RoomPosition(d.x, d.y, d.roomName);
	// rm = Game.rooms[d.roomName];
	// return rm.getPositionAt(d.x, d.y);
    }

    move_to(cr, dist) {
	let d = this.d;

	if(cr.pos.roomName !== d.roomName) {
	    // console.log( 'Creep ' + cr.name + ' moves to room ' + d.roomName );
	    cr.moveTo(this.getPos());
	    return true;
	}
	dist = defaultFor(dist, 3);

	if(d.res_id) {
	    let res = Game.getObjectById(d.res_id);
	    let srez = PathFinder.search( cr.pos, { pos: res.pos, range: 1 }, {
		// We need to set the defaults costs higher so that we
		// can set the road cost lower in `roomCallback`
		plainCost: 2,
		swampCost: 10,
		maxOps: 4000,
		roomCallback: function(roomName) {
		    let room = Game.rooms[roomName];
		    // In this example `room` will always exist, but since PathFinder 
		    // supports searches which span multiple rooms you should be careful!
		    if (!room) return;
		    let costs = new PathFinder.CostMatrix;
		    room.find(FIND_STRUCTURES).forEach(function(structure) {
			if (structure.structureType === STRUCTURE_ROAD) {
			    // Favor roads over plain tiles
			    costs.set(structure.pos.x, structure.pos.y, 1);
			} else if (structure.structureType !== STRUCTURE_RAMPART || 
				   !structure.my) {
			    // Can't walk through buildings, except for our own ramparts
			    costs.set(structure.pos.x, structure.pos.y, 0xff);
			}
		    });
		    // Avoid creeps in the room


		    room.find(FIND_CREEPS).forEach(function(creep) {
			costs.set(creep.pos.x, creep.pos.y, 30);
		    });


		    return costs;
		},
	    } );

	    /*
	    console.log('searchRez for ' + cr.name + ' to ' + res.pos + ' - ' + srez.path.length+ ', ' + srez.ops );
	    {
		let str = '';
		for(let i=0; i<srez.path.length; ++i) {
		    str = str + srez.path[i];
		    if(i==3)
			break;
		}
		console.log(str);		
	    }
	    */

	    
	    if(srez.path.length > dist) {
		let p2 = srez.path[0];
		cr.move(cr.pos.getDirectionTo(p2));
		return true;
	    }
	    /*
	    if(cr.pos.getRangeTo(res) > dist) {
		//let searchRez = ;
		// console.log('searchRez = ' + searchRez.path.length);
		// u.printObject(searchRez);

		u.log("Moving to object " + res, u.LOG_DBG);
		cr.moveTo(res);
		return true;
	    } else {
	    let srez = PathFinder.search( cr.pos, { pos: res.pos, range: 1 } );
		if(srez.path.length > 4) {
		    
		}
	    }
	    */
	} else {
	    if(cr.pos.getRangeTo(d.x, d.y) > dist) {
		cr.moveTo(d.x, d.y);
		return true;
	    }
	}
	return false;
    }
    
    take(cr) {
	let d = this.d;		
	if(d.full) {
	    if(creepIsFull(cr))
		return false;
	} else {
	    if(creepIsFilledWithAny(cr))
		return false;
	}

	if(this.move_to(cr, 3)) {
	    return true;
	}	

	let rm = Game.rooms[d.roomName];
	let p = this.getPos(rm);

	let done = false;
	// look for containers
	if(!done)
	{
	    let targets = p.findInRange(FIND_STRUCTURES, 2, {
		filter: (i) => i.structureType == STRUCTURE_CONTAINER && i.store[RESOURCE_ENERGY] > 0 } );
	    
	    if(targets.length > 0) {
		let target = cr.pos.findClosestByRange(targets);
		let status = target.transfer(cr, RESOURCE_ENERGY);
		if(status == ERR_NOT_IN_RANGE) {
		    cr.moveTo(target);
		}
		/*
		if(cr.pos.getRangeTo(target)>1){
		    cr.moveTo(target);
		} else {
		    target.transferEnergy(cr);
		}
		*/
		done = true;
	    }
	}
	// look for dropped energy
	if(!done)
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
	    } else {
		// take it from a creep
		
		let ts = this.getTS();
		let harvesters = ts.harvesters;
		if( !harvesters ) {
		    harvesters = ts.harvesters = p.findInRange(FIND_MY_CREEPS, 1, {
			filter: function(cr1) {
			    let mem = cr1.memory;
			    return (mem && mem.role && mem.role.name==='JobMiner' && (creepFullPct(cr1) > 0)); 
			}
		    });
		} /* else {
		    console.log('reuse');
		} */
		
		harvesters = _.sortBy(harvesters, function(cr1) {
		    return -creepFullPct(cr1) + cr.pos.getRangeTo(cr1)/10;
		} );

		// console.log('Creep ' + cr.id + ' - ' + JSON.stringify(
		//     _.map(harvesters, (h) => {return h.id;}) ) );
		    
		if(harvesters.length>0) {
		    let target = harvesters[0];// cr.pos.findClosestByRange(harvesters);
		    let status = target.transfer(cr, RESOURCE_ENERGY);
		    if(status == ERR_NOT_IN_RANGE) {
			cr.moveTo(target);
		    } else {
			ts.harvesters = [];
			// ts.harvesters.splice(0, 1);
			// u.log('Transfer energy returns ' + status, u.LOG_INFO);
		    }
		    done = true;
		}

		// console.log('Creep ' + cr.id + ' - ' + JSON.stringify(
		//     _.map(harvesters, (h) => {return h.id;}) ) );
		
	    }
	}

	return true;
    }
    
    give(cr) {
	u.log("AddrHarvPoint - cannot give " + cr.name, u.LOG_WARN);
	return false;
    }
}

class AddrUpkeep extends Addr {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrUpkeep'; }

    static create(rm_name) {
    	return { cname: 'AddrUpkeep',
		 roomName: rm_name,
    		 tgt_id_lst: [],
	       };
    }

    getFirstTgt() {
	let d = this.d;
	let ret =  (d.tgt_id_lst.length>0) ? d.tgt_id_lst[0] : null;
	return ret;
    }

    getFirstTgtObj() {
	let tgt = this.getFirstTgt();
	let ret = tgt ? Game.getObjectById(tgt) : null;
	return ret;
    }

    removeFirstTgt() {
	let d = this.d;
	if (d.tgt_id_lst.length>0) {
	    // delete d.tgt_id_lst[0];
	    d.tgt_id_lst.splice(0, 1);
	}
    }

    setNewTargets(targets) {
	let d = this.d;

	let fst_id = this.getFirstTgt();
	if(targets.length > 0) {
	    let targets2 = {};
	    for(let i of d.tgt_id_lst) {
		targets2[i]=0;
	    }
	    for(let j of targets) {
		targets2[j]=0;
	    }
	    let targets3=[];
	    for(let k in targets2) {
		targets3.push(k);
	    }

	    let targets4=_.filter(targets3, function(k) { return (k && (k!=null) && (k!='null') && (k!=="")) ? true : false; } );

	    // targets = _.union([d.tgt_id_lst, targets]);
	    // let targets2 = _.uniq(targets, function(n) {
	    // 	return String(n);
	    // });
	    
	    let this_ = this;
	    
//	    console.log('targets3=' + targets3);
//	    console.log('targets4=' + targets4);

	    targets = _.sortBy(targets4, function (tgt_id) {
		let object = Game.getObjectById(tgt_id);
		// console.log('id='+ tgt_id);
		let hitsMax = this_.getHitsUpkeepLimit(object);
		// console.log('hitsMax='+ hitsMax);
		
		let pri = (object.hits / hitsMax);
		if(fst_id && object.id == fst_id) {
		    pri = ((object.hits-5000) / hitsMax)
		}
		return pri;
	    } );

	    d.tgt_id_lst = targets;
	}

	while(d.tgt_id_lst.length>0) {
	    if(!this.getFirstTgtObj()) {
		this.removeFirstTgt();
	    } else {
		break;
	    }
	}
    }

    getReqQta() {
	let d = this.d;
	return (d.tgt_id_lst.length>0) ? 5 : 0;
    }

    getHitsUpkeepLimit(obj) {
	let limit = 100000;
	if( (obj.structureType===STRUCTURE_WALL) ||
	    (obj.structureType===STRUCTURE_RAMPART) ) {
	    limit = 1000;
	}

	let limit2 = obj.hitsMax;
	return (limit2<limit) ? limit2 : limit;
    }

    init() {
    };

    getPos(rm) {
	let d = this.d;
	let tgt = this.getFirstTgtObj();
	return tgt ? tgt.pos : null;
    }

    move_to(cr, dist) {
	dist = defaultFor(dist, 1);
	
	let d = this.d;
	let tgt = this.getFirstTgtObj();
	if(tgt) {
	    if(cr.pos.getRangeTo(tgt) > dist) {
		cr.moveTo(tgt);
		return true;
	    }
	    return false;
	} else {
	    u.log("AddrUpkeep - cannot find target ", u.LOG_WARN);
	    return true;
	}
    }
    
    take(cr) {
	u.log("AddrUpkeep - cannot take from target ", u.LOG_WARN);
	return false;
    }
    
    give(cr) {
	if(cr.carry[RESOURCE_ENERGY] === 0)
	    return false;
	u.log("AddrUpkeep - cannot give to target ", u.LOG_WARN);
	return false;
    }

    build(cr) {
	if(cr.carry[RESOURCE_ENERGY] === 0)
	    return false;
	
	let d = this.d;
	let tgt = this.getFirstTgtObj();

	if(tgt) {
	    let ret = 0;
	    if(tgt.structureType === STRUCTURE_CONTROLLER) {
		u.log("AddrUpkeep - cannot repari controller " + tgt.id, u.LOG_WARN);
		return false;
	    } else if (tgt.hits >= this.getHitsUpkeepLimit(tgt)) {
		u.log("AddrUpkeep - Target is already fully repaired" + tgt.id, u.LOG_WARN);
		this.removeFirstTgt();
		return false;
	    } else {
		ret = cr.repair(tgt);
	    }
	    if( ret == ERR_NOT_IN_RANGE ) {
		cr.moveTo(tgt);
	    } else if (ret == ERR_INVALID_TARGET) {
		u.log("AddrUpkeep - Invalid darget" + tgt.id, u.LOG_WARN);
		this.removeFirstTgt();
		return false;
	    }
	    // todo - analyze error code
	} else {
	    u.log("AddrUpkeep - cannot find target ", u.LOG_WARN);
	    return false;
	}
	
	return true;
    }

    getWorkerEnRate() {
	let ret = 5;
	return ret;
    }

    exists() {
	let ret = (this.getFirstTgtObj() != null);
	return ret;
    }
}

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
	if(creepIsFilledWithAny(cr))
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
		let rm = getCreepRoom(cr);
		let cp = f.make(rm.memory.wait_point, null);
		cp.move_to(cr);
	    }
	    // todo - analyze error code
	} else {
	    u.log("AddrBuilding - cannot find target " + d.tgt_id, u.LOG_WARN);	    
	}
	
	return true;
    }

    getWorkerEnRate() {
	let d = this.d;
	let tgt = Game.getObjectById(d.tgt_id);	
	let ret = 5;
	if(tgt) {
	    if(tgt.structureType === STRUCTURE_CONTROLLER) {
		ret = 1;
	    } else {
		ret = 5;
	    }
	}
	return ret;
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

    static createFromTask(rm, new_job_id, task) {

	let job = { id : new_job_id,
		    cname: 'JobMiner',
		    taken_by_id: null,
		    priority : defaultFor(task.d.priority, jobPriorities.mining),
		    capacity: 1,
		    curPower: 0,
		    reqQta: task.d.reqQta || 10,
		    res_id: null,
		    res_pos : task.d.pts[0],
		    maxCapacity: task.d.maxCapacity,
		    drop_id: null,
		    drop_name: getRoomSpawnName(rm), //'Spawn1',
		    task_id: task.d.id,
		  };
	
	return job
    }

    calcCreepPwr(rm, cr) {
	return cr ? cr.memory.design[WORK] * 2 : 0;
    }

    getHelperJob(rm) {
	let d = this.d;
	let helper_id = 'carry_' + d.id;
	let ret = f.make(rm.memory.jobs.JobCarrier[helper_id], null);
	return ret;
    }

    getLimitedCurPower(qta) {
	if(this.buildingInProgress()) {
	    return 0;
	}
	let d = this.d;
	let res = this.findRes();
	let maxQta = res ? (res.energyCapacity/300) : 5;
	return (qta<maxQta) ? qta : maxQta;
    }

    findRes(rm) {
	let d = this.d;
	try {
	    if(!d.res_id) {
		if(d.res_pos) {
		    // let pos = rm.getPositionAt(d.res_pos.x, d.res_pos.y);
		    let pos = f.make(d.res_pos, null).getPos(rm);
		    let source = pos.findClosestByRange(FIND_SOURCES);
		    d.res_id = source.id;
		}
	    }

	    return Game.getObjectById(d.res_id);
	}catch (err) {
	}
	return null;
    }
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	this.findRes(rm);

	if(!d.drop_id) {
	    d.drop_id = Game.spawns[d.drop_name].id;
	}
	
	role.workStatus = {
	    step: 0
	}
    }

    finish_work(rm) {
    }

    /*
    maybeStartBuildingContainer(rm, cr) {
	let d = this.d;

	if(!d.autoContainers)
	    return false;

	let res = this.findRes(rm)
	if(!res)
	    return false;
	
    }
    */

    buildingInProgress(rm) {
	let d = this.d;
	if(!d.building)
	    return false;
	let o = Game.getObjectById(d.building);
	return o && (o instanceof ConstructionSite);
    }

    maybeBuildContainer(rm, cr) {
	let d = this.d;

	if(!d.autoContainers)
	    return false;

	let res = this.findRes(rm)
	if(!res)
	    return false;

	let keepBuilding = false;

	if( d.building ) {
	    let o = Game.getObjectById(d.building);
	    if(!o) {
		d.building = null;
	    } else {
		if (o instanceof StructureContainer) {
		    // already have it
		    return false;
		} else if(o instanceof ConstructionSite) {
		    // looks good - keep building
		    keepBuilding = true;
		} else {
		    d.building = null;
		}
	    }
	}

	// look for container
	if(!d.building) {
	    
	    let new_pos = null;
	    try {
		if(d.task_id) {
		    let tsk = rm.memory.tasks[d.task_id];
		    new_pos = f.make(tsk.pts[1],null).getPos(rm);
		}
	    } catch(err) { console.log('maybeBuilderContainer - ' + err); }


	    if(new_pos) {
		let targets = new_pos.lookFor(FIND_STRUCTURES);
		if(targets.length>0 && targets[0].structureType == STRUCTURE_CONTAINER) {
		    d.building = targets[0].id;
		    return false;
		}
		targets = new_pos.lookFor(LOOK_CONSTRUCTION_SITES);
		if(targets.length>0 && targets[0].structureType == STRUCTURE_CONTAINER) {
		    d.building = targets[0].id;
		    return true;
		}
	    } else {
		let targets = res.pos.findInRange(FIND_STRUCTURES, 2, {
		    filter: (i) => i.structureType == STRUCTURE_CONTAINER } );
		if(targets.length>0 && targets[0].structureType == STRUCTURE_CONTAINER) {
		    d.building = targets[0].id;
		    return false;
		}

		targets = res.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
		    filter: (i) => i.structureType == STRUCTURE_CONTAINER } );
		if(targets.length>0 && targets[0].structureType == STRUCTURE_CONTAINER) {
		    d.building = targets[0].id;
		    return true;
		}
	    }

	    // create it
	    if(!new_pos && cr.pos.getRangeTo(res.pos)<2) {
		new_pos = cr.pos;
	    }

	    if(new_pos) {
		let rm2 = Game.rooms[new_pos.roomName];
		let status = rm2.createConstructionSite(new_pos.x, new_pos.y, STRUCTURE_CONTAINER);
		if(status == OK) {
		    u.log( 'Created construction site ' + STRUCTURE_CONTAINER, u.LOG_INFO );
		    return true;
		}
	    }
	}

	if(d.building) {
	    if(creepFullPct(cr)<0.7) {
		if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
		    cr.moveTo(res);
		}
	    } else { 
		let tgt = Game.getObjectById(d.building);
		if(cr.build(tgt) == ERR_NOT_IN_RANGE) {
		    cr.moveTo(tgt);
		}
	    }

	    return true;
	}

	return false;
    }

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;
	let res = this.findRes(rm); //Game.getObjectById(d.res_id);
	let drop = Game.getObjectById(d.drop_id);

	let needToCarry = rm.memory.recoveryMode; // || d.res_pos.hasContainer
	// let needToCarry = true;
	/*
	try {
	    let car_job_id = 'carry_'+d.id;
	    let car_job = rm.memory.jobs.JobCarrier[car_job_id];
	    let ccar_job = f.make(car_job, null);
	    if(ccar_job.getCount() > 0) {
		needToCarry = false;
	    }
	} catch (err) {
	u.log( 'Error looking for carrier for ' + d.id + ' - ' + err, u.LOG_ERR );
	}
	*/

	let loop_it = 0;
	while( loop_it++ < 2 ) {

	    if(needToCarry) {
		if(role.workStatus.step === 0) {
		    if( cr.carry[RESOURCE_ENERGY] < cr.carryCapacity ) {
			if(res) {
			    if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
				cr.moveTo(res);
			    }
			} else {
			    // res == null when it is in a different room
			    let pos = f.make(d.res_pos, null);
			    pos.move_to(cr, 1);
			}
			break;
		    } else {
			role.workStatus.step++;
		    }
		}

		// deliver
		if(role.workStatus.step === 1) {
		    if(creepIsFilledWithAny(cr)) {
			let status = cr.transfer(drop, RESOURCE_ENERGY);
			if(status == ERR_NOT_IN_RANGE ) {
			    cr.moveTo(drop);
			} else if(status == OK) {
			} else {
			    u.log( 'cr.transfer(drop) returns ' + status, u.LOG_WARN );
			}
			break;
		    } else {
			role.workStatus.step++;
		    }
		}

		role.workStatus.step = 0;
	    } else {
		role.workStatus.step = 0;
		if(res) {
		    if(this.maybeBuildContainer(rm, cr)) {
		    } else {
			if(!creepIsFull(cr)) {
			    if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
				cr.moveTo(res);
			    }
			} else {
			    // look for a container
			    let targets = res.pos.findInRange(FIND_STRUCTURES, 2, {
				filter: (i) => i.structureType == STRUCTURE_CONTAINER } );
			    
			    if(targets.length > 0) {
				let target = cr.pos.findClosestByRange(targets);
				let status = cr.transfer(target, RESOURCE_ENERGY);
				if(status == ERR_NOT_IN_RANGE) {
				    cr.moveTo(target);
				}
			    } else {
				// the creep is full, and there is no container
				if(d.mayDrop) {
				    if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
					cr.moveTo(res);
				    }				
				} else {
				    cr.moveTo(res);
				}

			    }
			    
			}
		    }
		    
		} else {
		    // res is null if it's in another room
		    let pos = f.make(d.res_pos, null);
		    pos.move_to(cr, 1);
		}
		/* else {
		   if(cr.carry[RESOURCE_ENERGY] > 40)
		   cr.drop(RESOURCE_ENERGY);
		   } */
		break;
	    }
	    
	    role.workStatus.step = 0;
	}
    }

}


class JobClaim extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobClaim'; }

    static create(new_job_id, roomName){
	let ret = {
	    cname: 'JobClaim',
	    id: new_job_id,
	    taken_by_id: null,
	    capacity: 1,
	    reqQta: 1,
	    priority : jobPriorities.claim,
	    res_pos:{ cname: 'AddrFreeRoom',
    		      roomName: roomName,
    		      x: 25,
    		      y: 25 }
	};

	return ret;
    }

    static createFromTask(rm, new_job_id, task) {
	let ret = {
	    cname: 'JobClaim',
	    id: new_job_id,
	    taken_by_id: null,
	    capacity: 1,
	    reqQta: 1,
	    priority : jobPriorities.claim,
	    res_pos: f.make(task.d.pts[0], null).makeRef(),
	    task_id: task.d.id,
	};
	
	return ret;
    }

    calcCreepPwr(rm, cr) {
	return cr ? cr.memory.design[CLAIM] : 0;
    }

    // find controller
    findCtrlr(rm) {
	let d = this.d;
	try {
	    if(!d.res_id) {
		if(d.res_pos) {
		    let pos = f.make(d.res_pos, null).getPos(rm);
		    rm = Game.rooms[pos.roomName];
		    let ctrlrs = rm.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTROLLER } });
		    let ctrl = ctrlrs[0];
		    d.res_id = ctrl.id;
		}
	    }

	    return Game.getObjectById(d.res_id);
	} catch (err) {
	    console.log(err);
	}
	return null;
    }
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	this.findCtrlr(rm);

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
	let ctrlr = this.findCtrlr(rm); //Game.getObjectById(d.res_id);
	let tt = f.make(d.res_pos);

	if(ctrlr && ctrlr.my) {
	    u.log( 'Controller in room ' + d.res_pos.roomName + ' belongs to us', u.LOG_INFO );
	    d.done = true;
	    this.finish_work();
	    return;
	}


	if( !ctrlr && tt.move_to(cr,1) ) {
	    return;
	} else {
	    if(!ctrlr) {
		u.log( 'Unable to find controller in room ' + d.res_pos.roomName, u.LOG_ERR );
		this.finish_work();
		return;
	    } else {
		let status = cr.claimController(ctrlr);
		if(status == ERR_NOT_IN_RANGE) {
		    cr.moveTo(ctrlr);
		} else {
		    if(status == OK) {
		    } else {
			u.log( 'Unable to claim controller in room ' + d.res_pos.roomName + ' status: ' + status, u.LOG_ERR );
			this.finish_work();
			return;
		    }
		}
	    }
	}
    }
}


class JobCarrier extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobCarrier'; }

    static createFromTask(rm, new_job_id, task) {
	let extraCapacity = defaultFor(task.d.extraCapacity,
				       (task instanceof TaskMining ? 1 : 0));
	/*
	if(task instanceof TaskMining) {
	    extraCapacity = 1;
	    console.log('Adding extra capacity');
	}
	*/
	
	console.log('extra capacity - ' + extraCapacity);
	
	let job = { id : new_job_id,
		    cname: 'JobCarrier',
		    taken_by_id: null,
		    priority : defaultFor(task.d.priority, jobPriorities.mining)+1,
		    capacity: 0, // todo
		    curPower: 0,
		    reqQta: 0,
		    extraCapacity: extraCapacity,
		    take_from :  task.d.pts[0],
		    take_to : rm.memory.storagePoint,
		    task_id: task.d.id,
		  }

	return job
    }

    calcCreepPwr(rm, cr) {
	return cr.memory.design[CARRY] * 50;
    }

    setHelperQuota(rm, qta) {
	let d = this.d;
	d.reqQta = qta;
    }
    
    updateCapacity(rm) {
	let d = this.d;

	if(!d.curPower) {
	    d.curPower = 0;
	}	
	
	if(!d.reqQta) {
	    if(d.capacity) {
		this.unassign(rm);
		d.capacity = 0;
	    }
	} else {
	    let avg_trip_time = defaultFor(d.avg_trip_time, 3);
	    if(avg_trip_time <=0)
		avg_trip_time = 1;
	    let reqQtaDist = d.reqQta * avg_trip_time * 2;
	    // getCount, reqQta, workRate
	    if(this.getCount() === this.getCapacity()) {
		if(d.curPower < 0.95 * reqQtaDist) {
		    d.capacity ++;
		}
	    }

	    if( (this.getCount() > 0) &&
		(this.getCount() <= this.getCapacity()) &&
		(d.curPower > 1.1 * reqQtaDist)) {
		let cr_id = this.getFirstWorkerId();
		let cr = Game.getObjectById(cr_id);
		let cr_pwr = cr.memory.design[CARRY] * 50;
		// console.log('updateCapacity - '+reqQtaDist +', '+d.curPower +', '+ cr_pwr);
		if((d.curPower - cr_pwr) > (1.1 * reqQtaDist)) {
		    this.unassign(rm, cr);
		    d.capacity--;
		}
	    }

	    if( typeof d.maxCapacity !== 'undefined' ) {
		if(d.capacity>d.maxCapacity) {
		    d.capacity = d.maxCapacity;
		}
	    }	    
	}
    }


    estimateTripTime() {
	let d = this.d;
	try
	{
	    let tf = f.make(d.take_from);
	    let tt = f.make(d.take_to);
	    
	    let dist = tf.getPos().getRangeTo(tt.getPos());

	    if(!dist || dist<3)  dist = 3;
	    if(dist>100) dist = 100;
	    d.avg_trip_time = dist;
	    u.log('Estimated distance for ' + d.id + ' - ' + dist, u.LOG_INFO);
	} catch (err) {
	    u.log('Error estimating distance for ' + d.id + ' - ' + err, u.LOG_ERR);
	}
    }

    
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
	    step: 0,
	    trip_start_time: 0
	}
    }

    finish_work(rm) {
    }

    findTarget(rm, cr) {

	var target = cr.pos.findClosestByRange(FIND_MY_STRUCTURES, {
	    filter: function(o) { 
		return (o.structureType == STRUCTURE_EXTENSION) && o.energy < o.energyCapacity; } } );

	if(target)
	    return target;

	var targets = rm.find(FIND_MY_SPAWNS, {				       
	    filter: function(o) { return o.energy < o.energyCapacity; } } );

	if(targets.length)
	    return targets[0];
	
	return null;
    }

    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	let loop_it = 0;
	try {

	    while( loop_it++ < 2 ) {

		if(role.workStatus.step === 0) {
		    // let tf = f.make(d.take_from);
		    // if(tf.move_to(cr)) {
		    //     break;
		    // } else {
		    //     role.workStatus.step++;
		    // }
		    role.workStatus.step++;
		}

		if(role.workStatus.step === 1) {
		    let tf = f.make(d.take_from);
		    if(tf.take(cr)) {
			break;
		    } else {
			if(tf.exists() ) {
			    role.workStatus.trip_start_time = Game.time;
			    role.workStatus.step++;
			} else {
			    d.done = true;
			}
		    }
		}

		let tt = f.make(d.take_to);
		if(tt.d.isSpawn) {
		    if(cr.carry[RESOURCE_ENERGY] === 0) {
			if(role.workStatus.trip_start_time) {
			    let trip_time = Game.time - role.workStatus.trip_start_time+1;
			    if(!d.avg_trip_time) {
				d.avg_trip_time = trip_time;
			    } else {
				d.avg_trip_time = 0.7 * d.avg_trip_time + 0.3 * trip_time;
			    }
			    role.workStatus.trip_start_time = 0;
			}		    
			role.workStatus.step = 0;
		    } else {
			let tgt = this.findTarget(rm, cr);
			if(tgt) {
			    if( cr.transfer(tgt, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE ) {
				cr.moveTo(tgt);
			    } 
			} else {
			    if(role.workStatus.trip_start_time)
				role.workStatus.trip_start_time++; // don't count this as trip time
			    tt.move_to(cr);
			    // todo - go to the wait point
			}
			break;
		    }
		} else {
		    if(role.workStatus.step === 2) {

			if(tt.move_to(cr)) {
			    break;
			} else {
			    if(role.workStatus.trip_start_time) {
				let trip_time = Game.time - role.workStatus.trip_start_time+1;
				u.log('trip_time ' + d.id + ', ' + cr.name + ' - '  + trip_time);
				if(!d.avg_trip_time) {
				    d.avg_trip_time = trip_time;
				} else {
				    d.avg_trip_time = 0.7 * d.avg_trip_time + 0.3 * trip_time;
				}
				role.workStatus.trip_start_time = 0;
			    }

			    role.workStatus.step++;
			}
		    }

		    if(role.workStatus.step === 3) {
			if(tt.give(cr)) {
			    break;
			} else {
			    this.moveWorkerToEndOfLine(rm, cr);
			    role.workStatus.step++;
			}
		    }
		}
		
		if(role.workStatus.step === 4) {
		    role.workStatus.step = 0;
		}
	    }
	    
	} catch(err) {
	    u.log('Error ' + err + ' Creep: ' + cr.name, u.LOG_ERR );
	}
	    
    }    
}

function getCreepRoom(cr) {
    // let roomName = cr.memory.roomName ? cr.memory.roomName : defaultRoom;
    return Game.rooms[cr.memory.roomName];
}

function getCreepsJob(cr) {
    let role = cr.memory.role;
    let rm = getCreepRoom(cr);
    
    if(role) {
	let job_id = role.job_id;
	if(job_id) {
	    let jobs = rm.memory.jobs[role.name];
	    if(jobs) {
		let job = jobs[role.job_id];
		if(job) {
		    return f.make(job, null);
		}
	    }
	}
    }
    u.log("Can't find job for creep " + cr.name, u.LOG_WARN);
    return null;
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

    calcCreepPwr(rm, cr) {
	let d = this.d;
	if(!d.workRate) {
	    let tt = f.make(d.take_to);
	    d.workRate = tt.getWorkerEnRate();
	}
	return cr.memory.design[WORK] * d.workRate;
    }

    getHelperJob(rm) {
	let d = this.d;
	let helper_id = 'help_' + d.id;
	return f.make(rm.memory.jobs.JobCarrier[helper_id], null);
    }    
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	role.workStatus = {
	    step: 0
	}

	let tfp = f.make(d.take_from).getPos(rm);
	let ttp = f.make(d.take_to).getPos(rm);

	// console.log( 'path ' + tfp + ', ' + ttp + ', ' + tfp.findPathTo(ttp) );

	//	if(tfp && ttp && tfp.findPathTo(ttp).length > 10) {
	if(tfp && ttp && !d.no_help_job && tfp.getRangeTo(ttp) > 7) {
	    // create JobSupplyBulder for this job
	    let car_jobs = rm.memory.jobs['JobCarrier'];
	    let car_job_id = 'help_' + d.id;
	    if(!car_jobs[car_job_id]) {
		let job = JobSupplyBulder.create(car_job_id, d, null);
		car_jobs[car_job_id] = job;
	    }
	    this.calcPower(rm); // this should update the helper job quota
	}

	if(cr.carry[RESOURCE_ENERGY]>=10) {
	    role.workStatus.step = 2;
	}
    }

    finish_work(rm) {
	let d = this.d;
	
	d.done = true;
	this.unassign(rm);

	// finish carrier job
	let car_jobs = rm.memory.jobs['JobCarrier'];	
	let car_job_id = 'help_' + d.id;
	let job = car_jobs[car_job_id]
	if(job) {
	    let cjob = f.make(job, null);
	    job.done = true;
	    cjob.unassign(rm);
	}
    }

    makeAssistedTFAddr(rm, tt) {
	let p = tt.getPos();
	let ret = null;
	if(p) {
	    ret = f.make( { cname: 'AddrPos',
			    roomName: p.roomName,
			    x: p.x,
			    y: p.y,
			    dist: 3}, null );
	}
	return ret;
    }
    
    do_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	while( true ) {

	    let tt = f.make(d.take_to);
	    if(!tt.exists())
	    {
		console.log('target does not exist');
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
		    /*
		    if(!d.take_from_local) {
			// save target pos into take_from_local
			let tgt = Game.getObjectById(d.take_to.tgt_id);
			if(tgt) {
			    let p = tgt.pos;
			    d.take_from_local = { cname: 'AddrPos',
						  roomName: rm.name,
						  x: p.x,
						  y: p.y,
						  dist: 3};
			    
			}

		    }
		    
		    if(d.take_from_local) {
			tf = f.make(d.take_from_local);
		    }
		    */
		    d.take_from_local = true;
		    tf = this.makeAssistedTFAddr(rm, tt);
		}
	    }
	    
	    if(role.workStatus.step === 0) {
		if(tf) {
		    if(tf.move_to(cr)) {
			break;
		    } else {
			role.workStatus.step++;
		    }
		} else {
		    u.log('TF address is null ' + d.id, u.LOG_WARN);
		    break;
		}
	    }

	    if(role.workStatus.step === 1) {
		if(tf) {
		    if(tf.take(cr)) {
			break;
		    } else {
			role.workStatus.step++;
		    }
		} else {
		    u.log('TF address is null ' + d.id, u.LOG_WARN);
		    break;
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

class JobSupplyBulder extends JobCarrier {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobSupplyBulder'; }

    static create(new_job_id, job_build, parent){
	let ret = {
	    cname: 'JobSupplyBulder',
	    id: new_job_id,
	    taken_by_id: null,
	    capacity: 0, //job_build.capacity,
	    reqQta: 0, // job_build.reqQta,
	    priority : job_build.priority,
	    take_from: job_build.take_from,
	    take_to: job_build.take_to,
	    main_job_id: job_build.id,
	};

	// calculate average trip time
	try
	{
	    let tf = f.make(ret.take_from);		
	    let tt = f.make(ret.take_to);
	    
	    let dist = tf.getPos().getRangeTo(tt.getPos());
	    
	    if(dist>50) dist = 50;
	    if(!dist || dist<3)  dist = 3;
	    ret.avg_trip_time = dist;
	    u.log('Estimated distance for ' + new_job_id + ' - ' + dist, u.LOG_INFO);
	} catch (err) {
	    u.log('Error estimating distance for ' + new_job_id + ' - ' + err, u.LOG_ERR);
	}
	return ret;
    }

    setHelperQuota(rm, qta) {
	let d = this.d;
	d.reqQta = qta;
    }    
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	role.workStatus = {
	    step: 0,
	    trip_start_time: 0
	}

	if(cr.carry[RESOURCE_ENERGY]>=10) {
	    role.workStatus.step = 2;
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
		// let tf = f.make(d.take_from);
		// if(tf.move_to(cr)) {
		//     break;
		// } else {
		//     role.workStatus.step++;
		// }
		role.workStatus.step++;
	    }

	    if(role.workStatus.step === 1) {
		let tf = f.make(d.take_from);		
		if(tf.take(cr)) {
		    break;
		} else {
		    role.workStatus.trip_start_time = Game.time;
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 2) {
		if(tt.move_to(cr, 5)) {
		    break;
		} else {
		    if(role.workStatus.trip_start_time) {
			let trip_time = Game.time - role.workStatus.trip_start_time+1;
			let recipientCnt = 0;
			{
			    let bld_jobs = rm.memory.jobs['JobBuilder'];
			    let wjob = bld_jobs[d.main_job_id];
			    if(wjob) {
				let cwjob = f.make(wjob, null);
				recipientCnt = cwjob.getCount();
			    }
			}
			trip_time += recipientCnt;
			if(!d.avg_trip_time) {
			    d.avg_trip_time = trip_time;
			} else {
			    d.avg_trip_time = 0.7 * d.avg_trip_time + 0.3 * trip_time;
			}
			role.workStatus.trip_start_time = 0;
		    }		    
		    role.workStatus.step++;
		}
	    }

	    if(role.workStatus.step === 3) {

		if(creepIsFilledWith(cr, RESOURCE_ENERGY)) {
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

		    let tgt = null;
		    {
			let workersListByDeficit = _.filter(workersList, function(c) {
			    return cr.pos.getRangeTo(c) < 8;
			} );
			workersListByDeficit = _.sortBy(workersListByDeficit, function(c) { return c.carry[RESOURCE_ENERGY] - c.carryCapacity; } );
			if(workersListByDeficit.length>0)
			    tgt = workersListByDeficit[0];
		    }

		    if(!tgt)
		    {
			workersList = _.filter(workersList, function(c) {
			    return ((c.carry[RESOURCE_ENERGY]+10) < c.carryCapacity);
			} );

			tgt = cr.pos.findClosestByRange(workersList/*, { filter: function(c) {
								     console.log(c.name + ' - ' + ((c.carry[RESOURCE_ENERGY]+30) < c.carryCapacity));
								     return ((c.carry[RESOURCE_ENERGY]+30) < c.carryCapacity);
								     } }*/);
		    }

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
    // 'd_h0' : [ WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, ],
    // 'd_h1' : [ WORK, WORK, CARRY, MOVE, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, MOVE, WORK, WORK, WORK, ],
    
    'd_h0' : [ WORK, WORK, CARRY, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, MOVE, CARRY, MOVE, MOVE, CARRY, MOVE, MOVE, CARRY, MOVE],
    'd_h1' : [ WORK, WORK, CARRY, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK, MOVE, CARRY, MOVE, CARRY, MOVE, MOVE, CARRY, MOVE, MOVE, CARRY, MOVE],
    
    'd_c1' : [ MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE ],
    // builder
    'd_b1' : [ WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK ],
    // slow builder
    // 'd_b2' : [ WORK, CARRY, MOVE, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK ],    
    'd_def1' : [ TOUGH, ATTACK, MOVE, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, TOUGH, ATTACK, MOVE, ],
    'd_claim' : [ CLAIM, MOVE, CLAIM, MOVE ],
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
	if((design == 'd_h0') || (design == 'd_h1')) {
	    return { work: 2, carry: 1, move: 1, ttb: 3};
	    // return [WORK, CARRY, MOVE];
	} else if (design == 'd_c1') {
	    return { carry: 2, move: 2, ttb: 4};
	    // return [CARRY, CARRY, MOVE];
	} 
    }

    let energy = rm.energyCapacityAvailable;
    if('d_claim' != design)
    {
	energy = _.min( [energy, defaultFor(rm.memory.config.creepCostLimit, 3000) ] );
    }

    if(!rm.memory.savedDsgn || rm.memory.savedDsgn.energy !== energy)
	rm.memory.savedDsgn = {energy: energy};
    let savedDsgn = rm.memory.savedDsgn;

    if(savedDsgn[design]) {
	// return from cache
	// u.log("Design for " + design + " - " + ret, u.LOG_DBG);
	return savedDsgn[design];
    }
    
    let proto = designRegistry[design];
    if(!proto) {
	u.log("Can't find design: " + design, u.LOG_WARN);
	return { work: 2, carry: 1, move: 1};
	// return [WORK, WORK, CARRY, MOVE];	
    }

    let i=0;
    let cost = 0;
    let ret = {
	ttb: 0, // time to build
    };
    while(cost < energy) {
	let next =  proto[i++];
	if(!next)
	    break;

	let cost1 = cost + costRegistry[next];
	
	if(cost1 > energy)
	    continue;
	
	cost = cost1;

	if(!ret[next]) {
	    ret[next] = 1;
	} else {
	    ret[next]++;
	}
	ret.ttb++;
	// if(next === TOUGH) {
	//     ret = [TOUGH].concat(ret);
	// } else {
	//     ret.push(next);
	// }
    }

    u.log("Design for " + design + " - " + ret, u.LOG_DBG);
    savedDsgn[design] = ret;
    
    return ret;
}

function getBodyFromDesign(design) {
    let body = [];
    Object.keys(design).forEach(function(key) {
	if(key === 'ttb' || key === 'cost')
	    return;
	let cnt = design[key];
	let t = new Array(cnt);
	t.fill(key);
	
	if(key === TOUGH) {
	    body  = t.concat(body);
	} else {
	    body = body.concat(t);
	}
    });
    return body;
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

	    let design = getDesign(d.design, spawn, rm);
	    let body = getBodyFromDesign(design);
	    mem.design = design;
	    mem.roomName = rm.name;
	    
	    //
	    let new_name = mem.role.name + '_' + Memory.next_creep_id;
	    let result = spawn.createCreep(body, new_name, mem);
	    role.workStatus = result;
	    
	    if(_.isString(result)) {
		Memory.next_creep_id++;
		u.log("Spawning " + result + " at " + spawn.name + " : " + body, u.LOG_INFO);
	    }
	    else {
		// u.log("Spawn error: " + result + " at " + spawn.name + " : " + body, u.LOG_ERR);

		this.finish_work(rm, spawn, false);
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
	    try {
		let cr = Game.creeps[role.workStatus];
		rm.memory.creeplist[cr.name]={id: cr.id};
		rm.memory.balance[d.bal_id].curCount++;
	    } catch (err) {
	    }
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

var allClasses = [ Job, JobMiner, JobCarrier, JobSpawn, /*JobMinerBasic, */JobDefender, Addr, AddrBuilding, AddrPos, JobBuilder, AddrHarvPoint, JobSupplyBulder,
		   AddrStoragePoint, AddrUpkeep, AddrFreeRoom, JobClaim,
		   TaskClaim, TaskMining, TaskConstr
		   /*, AddrHarvPointRef*/ ];


function makeUnique(list) {
    let obj = {};
    for(let o of list) {
	obj[o] = 1;
    }
    return Object.keys(obj);
}
///////////////////////////////////////////////////////
function initRoomTables(rm) {
    jobTypes = [];

    if(!rm.memory.jobs) {
	return;
    }

    try {
	if(!rm.memory.balance) {
	    u.log('No balance for room ' + rm.name, u.LOG_ERR);
	    return;
	}
	jobTypes = makeUnique( _.map(rm.memory.balance, 'role') );

	for(let job_name of jobTypes) {
	    if(!rm.memory.jobs[job_name]) {
		rm.memory.jobs[job_name]={};
	    }
	}
    } catch(err){
	u.log('initRoomTables error ' + err, u.LOG_ERR);
    }
    // console.log('initRoomTables returns ' + jobTypes);
}

// calculate room stats
function calcRoomStats(rm) {
    rm.memory.stats = {
	NZ: 0,
	enTotal: 0, // energy in the storage
	hasStorage: false, 
	enProd: 0, // mining pet turn
	enTotalQta: 0,
	enSpawnQta: 0, // spawner quota
	enCtrlQta: 0, // controller upgrade quote
	enBldQta: 0, // builders quota
	enRepairQta: 0,
	energyCapacityAvailable: rm.energyCapacityAvailable,
    };

    let stats = rm.memory.stats;
    let config = rm.memory.config;
    let cstor = f.make(rm.memory.storagePoint, null);


    rm.memory.NZ = rm.memory.NZ + defaultFor(config.NZInc, 0);
    rm.memory.NZ = _.min( [ rm.memory.NZ, cstor.getAmount(), cstor.getTotalCapacity() ] );
    stats.NZ = rm.memory.NZ;
    stats.enTotal = cstor.getAmount();

    // count energy per turn
    {
	let minerJobs = rm.memory.jobs.JobMiner;
	for(let job_id in minerJobs) {
	    let job = minerJobs[job_id];
	    let cjob = f.make(job, null);
	    let pwr = job.curPower;
	    // if(pwr > 10) pwr = 10;
	    stats.enProd += cjob.getLimitedCurPower(pwr);
	}
    }

    let extraQta = (stats.enTotal-2000 - stats.NZ);
    if(extraQta>0) extraQta = extraQta / 500;
    else extraQta = extraQta / 100;

    stats.enTotalQta = stats.enProd + extraQta;
    if(stats.enTotalQta<0) stats.enTotalQta = 0;
    stats.enCtrlQta = config.ctrlrShare * stats.enTotalQta;
    if(stats.enCtrlQta>20) stats.enCtrlQta = 20;
    stats.enBldQta = config.builderShare * stats.enTotalQta;
    stats.enRepairQta = config.repairShare * stats.enTotalQta;
}

function updateUpkeepQueue(rm) {

    let c_upkeep = f.make(rm.memory.upkeepPoint, null);

    let targets = rm.find(FIND_STRUCTURES, {
	filter: function (object) {
	    let hitsMax = c_upkeep.getHitsUpkeepLimit(object);
	    return (object.hits < (0.8*hitsMax));
	}
    });

    let target_ids = _.map(targets, obj => obj.id);

    c_upkeep.setNewTargets(target_ids);
}

function distanceFromBorder(pos) {
    return _.min([pos.x, pos.y, 49-pos.x, 49-pos.y]);
}

function planTowerJobs(rm) {
    let twrs = rm.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });

    let carrierJobs = rm.memory.jobs.JobCarrier;
    
    // refill jobs
    for(let twr of twrs) {
	let car_job_id = 'refill_' + twr.id;
	if(!carrierJobs[car_job_id]) {
	    let job = { id : car_job_id,
			cname: 'JobCarrier',
			taken_by_id: null,
			priority : jobPriorities.tower_refill,
			capacity: 0, // todo
			curPower: 0,
			reqQta: 0,
			take_from :  rm.memory.storagePoint,
			take_to : { cname: 'AddrBuilding',
				    roomName: rm.name,
				    tgt_id: twr.id,
				  },
		      };
	    carrierJobs[car_job_id] = job;
	}

	let cj = carrierJobs[car_job_id];
	if (twr.energy >= twr.energyCapacity) {
	    cj.reqQta = 0; 
	} else if(twr.energy >= (0.8 * twr.energyCapacity)) {
	    cj.reqQta = 5;
	} else if(twr.energy >= (0.5 * twr.energyCapacity)) {
	    cj.reqQta = 10;
	} else {
	    cj.reqQta = 15;
	}
    }

    if(rm.memory.jobs.JobBuilder['upkeep']) {
	rm.memory.jobs.JobBuilder['upkeep'].maxCapacity = (twrs.length > 0) ? 0 : 1;
    }

    let done = false;
    let target = Game.spawns[getRoomSpawnName(rm)].pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if(target) {
	if(target.owner.username == 'Source Keeper' || (distanceFromBorder(target.pos) > 5)) {
	    // actions
	    for(let twr of twrs) {
		u.log('Tower attacks ' + target, u.LOG_INFO);
		twr.attack(target);
	    }
	    done = true;
	}
    }
    
    if(!done) {
	target = Game.spawns[getRoomSpawnName(rm)].pos.findClosestByRange(FIND_MY_CREEPS, {
	    filter: function(cr) {
		return (cr.hits < cr.hitsMax);
	    }
	});

	if(target) {
	    for(let twr of twrs) {
		u.log('Tower heals ' + target.name, u.LOG_INFO);
		twr.heal(target);
	    }
	    done = true;
	}
    }
    if(!done) {
	// upkeep
	let c_upkeep = f.make(rm.memory.upkeepPoint, null);
	let tgt = c_upkeep.getFirstTgtObj();
	while(tgt && (tgt.hits >= c_upkeep.getHitsUpkeepLimit(tgt))) {
	    u.log("AddrUpkeep - Target is already fully repaired " + tgt.id + ' ', u.LOG_INFO);
	    c_upkeep.removeFirstTgt();
	    tgt = c_upkeep.getFirstTgtObj();
	}
	if(tgt) {
	    for(let twr of twrs) {
		u.log('Tower repairs ' + tgt.id, u.LOG_INFO);
		twr.repair(tgt);
		break; // only one tower is on repair
	    }	    
	}
    }
}

// Convert balance into JobSpawn jobs
function planSpawnJobs(rm) {


    //
    let bal_adj = {};
    let ttb_acc = 0;

    // Count all creeps that are near to end of life period.
    for(let cr_name in rm.memory.creeplist) {
	let cr_id = rm.memory.creeplist[cr_name].id;
	let cr = Game.getObjectById(cr_id);

	let bal_id = cr.memory.bal_id;
	let bal_ln = rm.memory.balance[bal_id];
	if(bal_ln) {
	    let dsgn_nm = bal_ln.design;
	    let ttb = getDesign(dsgn_nm, null, rm).ttb;
	    if(ttb && cr.ticksToLive <= ttb + ttb_acc) { // todo - add time to arrive at work
		ttb_acc += ttb;
		if(bal_adj[bal_id])
		    bal_adj[bal_id]++;
		else
		    bal_adj[bal_id] = 1;
	    }
	}
    }

    let jobs = rm.memory.jobs;
    if (!jobs['JobSpawn']) jobs['JobSpawn'] = {};
    let lst = jobs['JobSpawn'];

    let priority = 0;
    for(let i in rm.memory.balance) {
	let bal_ln = rm.memory.balance[i];
	priority = defaultFor(rm.memory.balance[i].priority, 10000);

	let job_id = bal_ln.id;
	let job = lst[job_id];
	let countInProgress = job ? job.capacity : 0;
	let adj = bal_adj[bal_ln.id] ? bal_adj[bal_ln.id] : 0;

	if(job) {
	    job.priority = priority;
	}

	if(bal_ln.count > bal_ln.curCount + countInProgress - adj) {
	    if(!lst[job_id]) {
		let new_job = {
		    cname: 'JobSpawn',
		    id: job_id,
		    taken_by_id: null,
		    capacity: (bal_ln.count - bal_ln.curCount + adj),
		    bal_id: bal_ln.id,
		    priority: priority,
		    design: bal_ln.design
		};

		u.log("New JobSpawn: " + job_id, u.LOG_DBG);
		lst[job_id] = new_job;
	    } else {
		job.capacity = bal_ln.count - bal_ln.curCount + adj;
		if (job.capacity<0)
		    job.capacity = 0;
	    }
	} else if (bal_ln.count < bal_ln.curCount + countInProgress - adj) {
	    if(job) {
		job.capacity = bal_ln.count - bal_ln.curCount + adj;
		if (job.capacity<0)
		    job.capacity = 0;
	    }
	}
    }
}

function assignSpawnJobs(rm) {
    let spawns = rm.find(FIND_MY_SPAWNS);

    let job_ids_by_priority = null;
    let job_ids_by_priority_idx = 0;
    
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
	    // The spawn is building a creep...
	    
	    let job = lst[spawn.memory.role.job_id];

	    if(!job) {
		u.log("Job not found " + spawn.memory.role.job_id, u.LOG_ERR);
		spawn.memory.role.job_id = null;
		spawn.memory.role.workStatus = null;
	    } else {
		continue; // work in progress
	    }
	}

	if(!job_ids_by_priority) {
	    job_ids_by_priority = sortJobsByPriority(lst, true);
	}

	//for(let i2 in lst) {
	if(job_ids_by_priority_idx < job_ids_by_priority.length) {
	    let job = lst[job_ids_by_priority[job_ids_by_priority_idx]];
	    let cjob = f.make(job, null);

	    // if(cjob.getCount()>0)
	    // 	continue;

	    // if(cjob.getCapacity() == 0)
	    // 	continue;

	    // take the job
	    // u.log("Spawn " + spawn.name + " takes " + job.id, u.LOG_DBG);
	    // spawn.memory.role.job_id = job.id;
	    // job.taken_by_id = spawn.id;
	    cjob.assign(rm, spawn);

	    // work on it
	    cjob.start_work(spawn.room, spawn);
	    job_ids_by_priority_idx++;
	}
    }
}

function sortJobsByPriority( jobs, exclueTaken ) {
    let job_ids = Object.keys(jobs);
    if(exclueTaken) {
	job_ids = _.filter(job_ids, function (id) {
	    let cjob = f.make(jobs[id], null);
	    return (cjob.getCapacity() > 0) && (cjob.getCount() < cjob.getCapacity());
	} );
    }

    job_ids = _.sortBy(job_ids, function(id) {
	let cjob = f.make(jobs[id], null);
	return cjob.getPriority();
    } );

    return job_ids;
}

function detectRecoveryMode(rm) {
    /*
    rm.memory.recoveryMode = (rm.memory.balance.c1.curCount + rm.memory.balance.c2.curCount == 0) ||
	(rm.memory.balance.h1.curCount + rm.memory.balance.h2.curCount == 0) ? 1 : 0;
    */
    
    rm.memory.recoveryMode = (rm.memory.balance.c2.curCount<1) ||
	(rm.memory.balance.h2.curCount == 0) ? 1 : 0;
    
    if(rm.memory.recoveryMode) {
	u.log("Roome " + rm.name + " in RECOVERY MODE", u.LOG_WARN);
    }
}

function countTotalJobsCapacity(jobs) {
    let count = 0;
    let pri = 10000;
    for(let id in jobs) {
	let cjob = f.make(jobs[id], null);
	if(cjob.getPriority() < 1000000) { // priority 1000000 is for waiting jobs
	    let capacity = cjob.getCapacity();
	    let curCount = cjob.getCount();

	    count = count + capacity;

	    if(capacity > curCount) {
		// find min priority
		let pri1 = cjob.getPriority() + curCount;
		if(pri1 < pri) pri = pri1;
	    }
	}
    }
    return {count: count, priority: pri};
}

// update the creeps balance - count and priority

let static_balance_ids={'h1': 1, 'c1': 1};

function nextTickPlanning(rm) {

    
    for(let job_type of jobTypes) {
	let stat = countTotalJobsCapacity(rm.memory.jobs[job_type]);
	let bal_id = _.find( rm.memory.balance, (o) => { return (o.role === job_type) && (!static_balance_ids[o.id]); } );
	if(bal_id) {
	    bal_id = bal_id.id;
	    let max = defaultFor(rm.memory.balance[bal_id].maxCount, 20);
	    // console.log('bal_id = ' + bal_id);

	    rm.memory.balance[bal_id].count = _.max([0, _.min([max, stat.count])]);
	    rm.memory.balance[bal_id].priority = stat.priority;
	} else {
	    u.log( "nextTickPlanning - can't find bal_id for job " + job_type, u.LOG_ERR );
	}
    }
    /*
    {
	let stat = countTotalJobsCapacity(rm.memory.jobs.JobBuilder);
	rm.memory.balance.b1.count = _.min([10, stat.count]);
	rm.memory.balance.b1.priority = stat.priority;
    }
    {
	let stat = countTotalJobsCapacity(rm.memory.jobs.JobCarrier);
	rm.memory.balance.c2.count = stat.count;
	rm.memory.balance.c2.priority = stat.priority;
    }
    {
	let stat = countTotalJobsCapacity(rm.memory.jobs.JobMiner);
	rm.memory.balance.h2.count = _.max([0, stat.count-1]);
	rm.memory.balance.h2.priority = stat.priority;
    }
    {
	let stat = countTotalJobsCapacity(rm.memory.jobs.JobClaim);
	rm.memory.balance.bal_claim.count = _.max([0, stat.count]);
	rm.memory.balance.bal_claim.priority = stat.priority;
    }
    */
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

    // tasks
    if(rm.memory.tasks) {
	let task_id_lst = Object.keys(rm.memory.tasks);
	for(let task_id of task_id_lst) {
	    try {
		let ctsk = f.make(rm.memory.tasks[task_id], null);
		ctsk.updateJobs(rm);
	    } catch(err) {
		u.log( "Error processing task " + task_id + " - " + err, u.LOG_ERR );
	    }
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
			    capacity: 0,
			    maxCapacity: 5,
			    priority : jobPriorities.ctrlr,
			    take_from: rm.memory.storagePoint,
			    take_to: { cname: 'AddrBuilding',
				       roomName: rm.name,
				       tgt_id: con.id },
			  };

		rm.memory.jobs.JobBuilder[con_job_id] = job;
	    }
	}
    }

    if(!rm.memory.jobs.JobBuilder['upkeep']) {
	let new_job_id = 'upkeep';
	if(!rm.memory.jobs.JobBuilder[new_job_id]) {
	    let job = { id: new_job_id,
			cname: 'JobBuilder',
			taken_by_id: null,
			capacity: 0,
			maxCapacity: 1,
			priority : jobPriorities.upkeep, 
			take_from: rm.memory.storagePoint,
			take_to: rm.memory.upkeepPoint,
		      };

	    rm.memory.jobs.JobBuilder[new_job_id] = job;
	}
    }

    let con_lst = rm.find(FIND_MY_CONSTRUCTION_SITES);
    if(rm.memory.extraConstructionSites) {
	for(let cid of rm.memory.extraConstructionSites) {
	    let con = Game.getObjectById(cid);
	    if(con) {
		con_lst.push(con);
	    }
	}
    }

    if(rm.memory.extraConstructionRooms) {
	for(let rm1_name of rm.memory.extraConstructionRooms) {
	    let rm1 = Game.rooms[rm1_name];
	    let con_lst1 = rm1.find(FIND_MY_CONSTRUCTION_SITES);
	    con_lst = con_lst.concat(con_lst1);
	}
    }

    
    for(let con_i in con_lst) {
	let con = con_lst[con_i];
	// let con_capacity = getConstrBuildingCapacity(rm, con);
	let con_job_id = 'con_' + con.id;
	if(!rm.memory.jobs.JobBuilder[con_job_id]) {
	    let job = { id: con_job_id,
			cname: 'JobBuilder',
			taken_by_id: null,
			capacity: 0,
			priority : jobPriorities.build,
			take_from: rm.memory.storagePoint,
			take_to: { cname: 'AddrBuilding',
				   roomName: con.pos.roomName, //rm.name,
				   tgt_id: con.id },
		      };


	    if(Game.getObjectById(con.id).progressTotal<10) {
		job.maxCapacity = 1;
		job.no_help_job=true;
	    }

	    rm.memory.jobs.JobBuilder[con_job_id] = job;
	}
    }


    // Claimer jobs
    for(let claimRoomName in rm.memory.claimRooms) {
	if(rm.memory.claimRooms[claimRoomName] === 'claim') {
	    rm.memory.claimRooms[claimRoomName] = 'claiming';
	    let job_id = 'claim_'+claimRoomName;
	    if(!rm.memory.jobs.JobClaim[job_id]) {
		rm.memory.jobs.JobClaim[job_id] = JobClaim.create(job_id, claimRoomName)
	    }
	}
    }

    // Carriers should give up their stuff
    if(!rm.memory.jobs.JobCarrier['waiting']) {
	let job = { id : 'waiting',
		    cname: 'JobCarrier',
		    taken_by_id: null,
		    priority : jobPriorities.waiting, // very low priority
		    capacity: 20, // todo
		    curPower: 0,
		    reqQta: 10000,
		    take_from :  rm.memory.wait_point,
		    take_to : rm.memory.storagePoint,
		  };
	rm.memory.jobs.JobCarrier['waiting'] = job;
    }
}

function assignJobQuotas(rm) {
    let stats = rm.memory.stats;

    // jc1
    {
	let jc1_job = rm.memory.jobs.JobCarrier.jc1;
	if(jc1_job) {
	    let qta = rm.memory.stats.enTotalQta - 3;
	    if(qta < 1) qta = 1;
	    else if(qta > 20) qta = 20;
	    jc1_job.reqQta = qta;
	}
    }
    // miners
    {
	let jobs = rm.memory.jobs.JobMiner;
	for(let id in jobs) {
	    let job = jobs[id];
	    let cjob = f.make(job, null);
	    
	    cjob.updateCapacity(rm);
	}
    }

    // builders
    {
	let jobs = rm.memory.jobs.JobBuilder;
	let carJobs = rm.memory.jobs.JobCarrier;
	let job_ids = sortJobsByPriority(jobs, false);
	let i=0;
	let quota = stats.enBldQta;
	let oneJobQta = 40;
	
	while(i<job_ids.length) {
	    let id = job_ids[i++];
	    let job = jobs[id];
	    let cjob = f.make(job, null);
	    if(quota<0.1) quota = 0;
	    if(id === 'ctrlr') {
		job.reqQta = stats.enCtrlQta;
	    } else if(id === 'upkeep') {
		let q1= f.make(rm.memory.upkeepPoint, null).getReqQta();
		q1 = _.min( [q1, 5, quota] );
		job.reqQta = q1;
		quota -= q1;
	    } else {
		if(quota > oneJobQta) {
		    job.reqQta = oneJobQta;
		    quota -= oneJobQta;
		} else {
		    job.reqQta = quota;
		    quota = 0;
		}
	    }

	    // cjob.updateCapacity(rm);
	}

	if(quota>0) {
	    try {
		let job = jobs['ctrlr'];
		let cjob = f.make(job, null);

		job.reqQta = _.min([20, job.reqQta+quota/2]);
		// cjob.updateCapacity(rm);
	    } catch(err) {
		u.log( 'Error ' + err, u.LOG_ERR );
	    }
	}

	for(let job_id of job_ids) {
	    let job = jobs[job_id];
	    let cjob = f.make(job, null);
	    cjob.updateCapacity(rm);
	}
    }

    // carriers
    {
	let jobs = rm.memory.jobs.JobCarrier;
	for(let id in jobs) {
	    let job = jobs[id];
	    let cjob = f.make(job, null);
	    
	    cjob.updateCapacity(rm);
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
			    let cjob = f.make(job, null);
			    try {
				cjob.calcPower(rm);
			    } catch(err){}
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

function reduceJobs(rm, jobs) {
    let job_id_lst = Object.keys(jobs);
    
    for(let job_id of job_id_lst) {
	let job = jobs[job_id];
	let cjob = f.make(job, null);
	while(cjob.getCount() > cjob.getCapacity()) {
	    let cr_id = cjob.getFirstWorkerId(); //Object.keys(cjob.d.taken_by_id)[0];
	    let cr = Game.getObjectById(cr_id);
	    cjob.unassign(rm ,cr);
	}
	if(job.done) {
	    cjob.unassign(rm);
	    delete jobs[job_id];
	}
    }
}

function transferCreepToRoom(crName, newRoomName) {
    try {
	let cr = Game.creeps[crName];
	let rm = getCreepRoom(cr);
	let newRoom = Game.rooms[newRoomName];
	let cjob = getCreepsJob(cr);
	if(cjob) {
	    cjob.unassign(rm, cr);
	}

	cr.memory.roomName = newRoomName;
	newRoom.memory.creeplist[cr.name]={id: cr.id};
	delete rm.memory.creeplist[cr.name];
	newRoom.memory.balance[cr.memory.bal_id].curCount++;
	rm.memory.balance[d.bal_id].curCount--;
    } catch(err) {
	u.log( 'Unable to transfer ' + crName + ' to ' + rmName, u.LOG_ERR );
    }
}


function sortCreepsByPriority( rm ,creeplist ) {
    let name_list = Object.keys(creeplist);

    name_list = _.filter(name_list, function (nm) {
	let cr = Game.getObjectById( creeplist[nm].id );
	return !cr.spawning && cr.memory.role;
    } );

    let sorted_name_list = _.sortBy( name_list, function(nm) {
	
	let cr = Game.getObjectById( creeplist[nm].id );
	let pri = 1000001;
	let role = cr.memory.role;

	if(role.job_id) {
	    let jobs = rm.memory.jobs[role.name];
	    let job = jobs[role.job_id];
	    pri = defaultFor( job.priority, pri );
	}
	// console.log( nm + " : " + pri );
	return -pri;
    } );
    // console.log( "sortJobsByPriority: " + job_ids );
    return sorted_name_list;
}


// 1. Unassign and remove creeps that no longer exist
// 2. If already has a job - keep looking
// 3. Assign a new job, otherwise - start_work()
function assignCreepJobs(rm) {

    // for(let room_idx in Game.rooms) {
    // 	let rm = Game.rooms[room_idx];

    for(let job_type of jobTypes) {
	reduceJobs(rm, rm.memory.jobs[job_type]);
    }

    let cwait_poit = f.make(rm.memory.wait_point, null);

    let sorted_name_list = sortCreepsByPriority(rm, rm.memory.creeplist );
    let sortedJobIds = {};
    for(let iii of jobTypes ) {
	sortedJobIds[iii] = {ids:[], idx: 0};
	sortedJobIds[iii].ids = sortJobsByPriority(rm.memory.jobs[iii], false);
    }	
    
    for(let cr_name of sorted_name_list) {
	let cr = Game.getObjectById( rm.memory.creeplist[cr_name].id );

	// if(cr.spawning)
	//     continue;

	let role = cr.memory.role;
	// if(!role)
	//     continue;
	
	let jobs = rm.memory.jobs[role.name];
	let sortedJobIdsRec = sortedJobIds[role.name];
	
	if(!jobs || !sortedJobIdsRec) {
	    u.log( "Creep " + cr_name + " has no job queue: " + role.name, u.LOG_WARN );
	    continue;
	}

	let pri = 100000001; // current creep's priority
	if(role.job_id) {
	    // if(role.name === 'JobMiner')
	    //   continue;
	    let job = jobs[role.job_id];
	    pri = defaultFor( job.priority, pri );
	}
	
	while(sortedJobIdsRec.idx < sortedJobIdsRec.ids.length) {
	    let job2 = jobs[ sortedJobIdsRec.ids[sortedJobIdsRec.idx++] ];
	    let pri2 = defaultFor(job2.priority, 1000001);
	    if( Math.floor(pri2/100) < Math.floor(pri/100) ) {
		let cjob2 = f.make(job2, null);

		if(job2.done) {
		    continue;
		}
		if(job2.onhold)
		    continue;
		
		if(cjob2.isFull())
		    continue;

		// may be unassign perv. job
		if(role.job_id) {
		    let txt = "Reassigning creep: " + cr_name + ' from: ' +  role.job_id + ' to: ' + job2.id;
		    u.log( txt , u.LOG_INFO);
		    let job = jobs[role.job_id];
		    let cjob = f.make(job, null);
		    cjob.unassign(rm ,cr);
		} else {
		    let txt = "Assigning creep: " + cr_name + ' to: ' + job2.id;
		    u.log( txt , u.LOG_INFO);
		}

		cr.say(job2.id);

		// take the job
		cjob2.assign(rm, cr);

		// work on it
		cjob2.start_work(rm, cr);
		break;
	    } else {
		break;
	    }
	}

	if(!role.job_id) {
	    // no job - move to wait_point
	    cwait_poit.move_to(cr);
	}
    }
}

/*
function assignCreepJobsOld(rm) {

    reduceJobs(rm, rm.memory.jobs['JobMiner']);
    reduceJobs(rm, rm.memory.jobs['JobCarrier']);
    reduceJobs(rm, rm.memory.jobs['JobBuilder']);
    reduceJobs(rm, rm.memory.jobs['JobDefender']);
    reduceJobs(rm, rm.memory.jobs['JobClaim']);

    let cwait_poit = f.make(rm.memory.wait_point, null);

    let sorted_name_list = sortCreepsByPriority(rm, rm.memory.creeplist );
    let sortedJobIds = {};
    for(let iii of ['JobMiner', 'JobCarrier', 'JobBuilder', 'JobDefender', 'JobClaim'] ) {
	sortedJobIds[iii] = {ids:[], idx: 0};
	sortedJobIds[iii].ids = sortJobsByPriority(rm.memory.jobs[iii], false);
    }	
    
    for(let cr_name of sorted_name_list) {
	let cr = Game.getObjectById( rm.memory.creeplist[cr_name].id );

	// if(cr.spawning)
	//     continue;

	let role = cr.memory.role;
	// if(!role)
	//     continue;
	
	let jobs = rm.memory.jobs[role.name];
	if(!jobs) {
	    u.log( "Creep " + cr_name + " has no job queue: " + role.name, u.LOG_WARN );
	    continue;
	}

	let pri = 1000001; // current creep's priority
	if(role.job_id) {
	    if(role.name === 'JobMiner')
		continue;
	    let job = jobs[role.job_id];
	    pri = defaultFor( job.priority, pri );
	}
	
	let sortedJobIdsRec = sortedJobIds[role.name];
	while(sortedJobIdsRec.idx < sortedJobIdsRec.ids.length) {
	    let job2 = jobs[ sortedJobIdsRec.ids[sortedJobIdsRec.idx++] ];
	    let pri2 = defaultFor(job2.priority, 1000001);
	    if(pri2<pri) {
		let cjob2 = f.make(job2, null);

		if(job2.done) {
		    continue;
		}
		if(job2.onhold)
		    continue;
		
		if(cjob2.isFull())
		    continue;

		// may be unassign perv. job
		if(role.job_id) {
		    u.log( "Reassigning creep: " + cr_name + ' from: ' +  role.job_id + ' to: ' + job2.id, u.LOG_INFO);
		    let job = jobs[role.job_id];
		    let cjob = f.make(job, null);
		    cjob.unassign(rm ,cr);
		} else {
		    u.log( "Assigning creep: " + cr_name + ' to: ' + job2.id, u.LOG_INFO);
		}

		// take the job
		cjob2.assign(rm, cr);

		// work on it
		cjob2.start_work(rm, cr);
		break;
	    } else {
		break;
	    }
	}

	if(!role.job_id) {
	    // no job - move to wait_point
	    cwait_poit.move_to(cr);
	}
    }
}
*/


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
    if(!rm || !rm.memory || !rm.memory.creeplist)
    {
	// u.log( 'Empty rm.memory.creeplist in toom  ' + rm.name, u.LOG_INFO );
	return;
    }

    rm.controller.activateSafeMode();

    initRoomTables(rm);
    
    cleanUpDeadCreeps(rm);
    detectRecoveryMode(rm);

    calcRoomStats(rm);
    updateUpkeepQueue(rm);
    planTowerJobs(rm);
    
    planCreepJobs(rm); // schedule new jobs for builders and carriers
    assignJobQuotas(rm); // assign quotas to jobs
    assignCreepJobs(rm); // assign creeps to new jobs
    
    nextTickPlanning(rm); // adjust the number of creeps on the balance
    planSpawnJobs(rm);  // // Convert balance into JobSpawn jobs
    assignSpawnJobs(rm);
    doAllJobs(rm);
}

function printCPULimits(loc)
{
    u.log( 'CPU limits at ' + loc + ' ' + Game.cpu.tickLimit + ' / ' + Game.cpu.getUsed() + ' bucket: ' + Game.cpu.bucket + ' + ' + Game.cpu.limit, u.LOG_INFO );
}

function calcCPUUsage()
{
    if(!Memory.cpuUsageAvg)
	Memory.cpuUsageAvg = 10;
    Memory.cpuUsageAvg = 0.9*Memory.cpuUsageAvg + 0.1 * Game.cpu.getUsed();
}

//RawMemory.set('{ "rooms": {}, "creeps": {} }' );
//console.log(RawMemory.get());
//Memory = JSON.parse(RawMemory.get());

config.maybeResetMemory();

u.initLog();
if(!Memory.log_level['global'])
{
    Memory.log_level['global'] = 3;
}

u.log('new global', u.LOG_DBG);

//regClasses(allClasses);

r.init();
config.updateConfig(memobj);

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
	u.log('new tick:' + Game.time, u.LOG_DBG);
	f.start_new_tick();

	// try {
	//     printCPULimits('Start');
	// } catch (err)
	// {
	//     u.log( 'Error ' + err, u.LOG_ERR );
	// }

	PathFinder.use(true);
	
	// collect stats
	myroom();

	for(let ri in Game.rooms) {
	    let rm = Game.rooms[ri];
	    processRoom(rm);
	}
	
	// processRoom(Game.rooms['W43S54']);
	// processRoom(Game.rooms['W43S55']);

	
	calcCPUUsage();
	// printCPULimits('End');

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
