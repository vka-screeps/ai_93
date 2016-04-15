var u = require('utils');
var _ = require('lodash');
var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var config = require('config');
//var stat = require('stat');
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

    makeRef() {
	if(this.d && this.d.obj_id) {
	    return { cname: 'ObjRef',
		     obj_id: this.d.obj_id };
	} else {
	    u.log( "Can't makeRef for " + this.getObjLogName(), u.LOG_WARN);
	}
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

    calcCreepPwr(rm, cr) {
	return 1;
    }


    getHelperJob(rm) {
	let d = this.d;
	// console.log('Job.getHelperJob for ' + d.id + ' = null ');
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
	this.forEachWorker(rm, function(rm, cr) {
	    d.curPower += this_.calcCreepPwr(rm, cr);
	} );

	
	let cjob2 = (function(rm) { return this_.getHelperJob(rm); })(rm);
	let qta2 = (function() { return this_.getLimitedCurPower(d.curPower); })();
	// console.log('calcPower - ' + d.id + ', ' + cjob2);

	if(cjob2) {
	    cjob2.setHelperQuota(rm, qta2);
	}
    }
    

    updateCapacity(rm) {
	let d = this.d;
	if(!d.curPower) {
	    d.curPower = 0;
	}
	
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
		let cr_pwr = cr.memory.design[WORK] * d.workRate;
		if((d.curPower - cr_pwr) > (1.1 * d.reqQta)) {
		    this.unassign(rm, cr);
		    d.capacity--;
		}
	    }
	}
	if(d.maxCapacity && d.capacity>d.maxCapacity) {
	    d.capacity = d.maxCapacity;
	}
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
	u.log( "Job " + d.id + " assigned to " + cr.name + ', priority=' + d.priority );
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

class AddrStoragePoint extends AddrPos {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'AddrStoragePoint'; }

    init() { };

    take(cr) {
	let d = this.d;		
	if(d.full) {
	    if(cr.carry[RESOURCE_ENERGY] >= cr.carryCapacity)
		return false;
	} else {
	    if(cr.carry[RESOURCE_ENERGY] > 0)
		return false;
	}

	let threshold = 500;
	let cjob = getCreepsJob(cr);
	if(cjob && cjob.d.priority < 10) {
	    threshold = 0;
	}

	if(this.getAmount() >= threshold) {
	    if(d.isActive) {

		if(this.move_to(cr, 3)) {
		    return true;
		}

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

	if(cr.carry[RESOURCE_ENERGY] === 0)
	    return false;

	this.getAmount(); // refresh cash data

	let tgt1 = _.find(d.containers, {isFull: false});
	if(tgt1) {
	    let tgt = Game.getObjectById(tgt1.id);
	    let status = cr.transfer(tgt, RESOURCE_ENERGY);
	    console.log( "transfer = " + tgt.id + status );
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
	    return false; // can move the same turn
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
	    {

		{
		    // let targets = p.findInRange(FIND_STRUCTURES, 1 ,{ filter: { structureType: STRUCTURE_CONTAINER }} );
		    let targets = p.findInRange(FIND_STRUCTURES, 1, {filter: function(o) {
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
			} );
		    };
		}
	    }
	    d.containers = containers;
	    d.energy = energy;
	}

	return d.energy;
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
	return rm.getPositionAt(d.x, d.y);
    }

    move_to(cr, dist) {
	dist = defaultFor(dist, 3);

	let d = this.d;
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

		u.log("Moving to object " + res, u.LOG_INFO);
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
	    if(cr.carry[RESOURCE_ENERGY] >= cr.carryCapacity)
		return false;
	} else {
	    if(cr.carry[RESOURCE_ENERGY] > 0)
		return false;
	}

	if(this.move_to(cr, 3)) {
	    return true;
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

// class AddrHarvPointRef extends AddrHarvPoint {
//     constructor(d, parent) {
// 	super(Memory.rooms[d.roomName].harvPoints[d.id], parent);
// 	this.ref_d = d;
//     }

//     static cname() { return 'AddrHarvPointRef'; }
// }

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

    calcCreepPwr(rm, cr) {
	return cr.memory.design[WORK] * 2;
    }

    getHelperJob(rm) {
	let d = this.d;
	let helper_id = 'carry_' + d.id;
	let ret = f.make(rm.memory.jobs.JobCarrier[helper_id], null);
	return ret;
    }

    getLimitedCurPower(qta) {
	return (qta<10) ? qta : 10;
    }
    
    start_work(rm, cr) {
	let d = this.d;
	let role = cr.memory.role;

	if(!d.res_id) {
	    if(d.res_pos) {
		// let pos = rm.getPositionAt(d.res_pos.x, d.res_pos.y);
		let pos = f.make(d.res_pos, null).getPos(rm);
		console.log( 'pos = ' + pos );
		let source = pos.findClosestByRange(FIND_SOURCES);
		d.res_id = source.id;
	    }
	}

	if(!d.drop_id) {
	    d.drop_id = Game.spawns[d.drop_name].id;
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

	let needToCarry = rm.memory.recoveryMode; // || d.res_pos.hasContainer

	let loop_it = 0;
	while( loop_it++ < 2 ) {

	    if(needToCarry) {
		if(role.workStatus.step === 0) {
		    if( cr.carry[RESOURCE_ENERGY] < cr.carryCapacity ) {
			if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
			    cr.moveTo(res);
			}
			break;
		    } else {
			role.workStatus.step++;
		    }
		}

		// deliver
		if(role.workStatus.step === 1) {
		    if(cr.carry[RESOURCE_ENERGY] > 0) {
			let status = cr.transferEnergy(drop);
			if(status == ERR_NOT_IN_RANGE ) {
			    cr.moveTo(drop);
			} else if(status == OK) {
			} else {
			    u.log( 'cr.transferEnergy(drop) returns ' + status, u.LOG_WARN );
			}
			break;
		    } else {
			role.workStatus.step++;
		    }
		}

		role.workStatus.step = 0;
	    } else {
		role.workStatus.step = 0;
		if(cr.harvest(res) == ERR_NOT_IN_RANGE) {
		    cr.moveTo(res);
		} else {
		    if(cr.carry[RESOURCE_ENERGY] > 40)
			cr.drop(RESOURCE_ENERGY);
		}
		break;
	    }
	    
	    role.workStatus.step = 0;
	}
    }

}

/*
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
		let source = pos.findClosestByRange(FIND_SOURCES);
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
*/

class JobCarrier extends Job {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobCarrier'; }

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

	let loop_it = 0;
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
		    role.workStatus.trip_start_time = Game.time;
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
			} else {
			    if(role.workStatus.trip_start_time) {
				let trip_time = Game.time - role.workStatus.trip_start_time+1;
				if(!d.avg_trip_time) {
				    d.avg_trip_time = trip_time;
				} else {
				    d.avg_trip_time = 0.7 * d.avg_trip_time + 0.3 * trip_time;
				}
				role.workStatus.trip_start_time = 0;
			    }
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
			if(role.workStatus.trip_start_time) {
			    let trip_time = Game.time - role.workStatus.trip_start_time+1;
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

function getCreepRoom(cr) {
    return Game.rooms[cr.pos.roomName];
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
	return f.make(rm.memory.jobs.JobCarrier[d.help_id], null);
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
	if(tfp && ttp && tfp.getRangeTo(ttp) > 8) {
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
						  roomName: rm.name,
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

class JobSupplyBulder extends JobCarrier {
    constructor(d, parent) {
	super(d, parent);
    }

    static cname() { return 'JobSupplyBulder'; }

    static create(new_job_id, job_build, parent){
	return {
	    cname: 'JobSupplyBulder',
	    id: new_job_id,
	    taken_by_id: null,
	    capacity: 0, //job_build.capacity,
	    reqQta: job_build.reqQta,
	    priority : job_build.priority,
	    take_from: job_build.take_from,
	    take_to: job_build.take_to,
	    main_job_id: job_build.id,
	};
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
		if(tt.move_to(cr, 3)) {
		    break;
		} else {
		    if(role.workStatus.trip_start_time) {
			let trip_time = Game.time - role.workStatus.trip_start_time+1;
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
    'd_c1' : [ MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE ],
    // builder
    'd_b1' : [ WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK ],
    // slow builder
    // 'd_b2' : [ WORK, CARRY, MOVE, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK, CARRY, MOVE, WORK, WORK, WORK ],    
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
	    return { work: 1, carry: 1, move: 1};
	    // return [WORK, CARRY, MOVE];
	} else if (design == 'd_c1') {
	    return { carry: 2, move: 1};
	    // return [CARRY, CARRY, MOVE];
	} 
    }

    let energy = rm.energyCapacityAvailable;    

    if(!rm.memory.savedDsgn || rm.memory.savedDsgn.energy !== energy)
	rm.memory.savedDsgn = {energy: energy};
    let savedDsgn = rm.memory.savedDsgn;

    if(savedDsgn[design]) {
	// return from cache
	// u.log("Design for " + design + " - " + ret, u.LOG_INFO);
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
    let ret = {};
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
	// if(next === TOUGH) {
	//     ret = [TOUGH].concat(ret);
	// } else {
	//     ret.push(next);
	// }
    }

    u.log("Design for " + design + " - " + ret, u.LOG_INFO);
    savedDsgn[design] = ret;
    
    return ret;
}

function getBodyFromDesign(design) {
    let body = [];
    Object.keys(design).forEach(function(key) {
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
	    
	    // 
	    
	    let result = spawn.createCreep(body, undefined, mem);
	    role.workStatus = result;
	    
	    if(_.isString(result)) {
		u.log("Spawning " + mem.role.name + " at " + spawn.name + " : " + body, u.LOG_INFO);
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

var allClasses = [ Job, JobMiner, JobCarrier, JobSpawn, /*JobMinerBasic, */JobDefender, Addr, AddrBuilding, AddrPos, JobBuilder, AddrHarvPoint, JobSupplyBulder,
		   AddrStoragePoint/*, AddrHarvPointRef*/ ];


///////////////////////////////////////////////////////

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
    };

    let stats = rm.memory.stats;
    let config = rm.memory.config;
    let cstor = f.make(rm.memory.storagePoint, null);
    stats.NZ = rm.memory.NZ;
    stats.enTotal = cstor.getAmount();

    // count energy per turn
    {
	let minerJobs = rm.memory.jobs.JobMiner;
	for(let job_id in minerJobs) {
	    let job = minerJobs[job_id];
	    let pwr = job.curPower;
	    if(pwr > 10) pwr = 10;
	    stats.enProd += pwr;
	}
    }

    stats.enTotalQta = stats.enProd + stats.enTotal / 10000;
    stats.enCtrlQta = config.ctrlrShare * stats.enTotalQta;
    stats.enBldQta = config.builderShare * stats.enTotalQta;
    stats.enRepairQta = config.repairShare * stats.enTotalQta;
}

// Convert balance into JobSpawn jobs
function planSpawnJobs(rm) {
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

	if(job) {
	    job.priority = priority;
	}
	
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
	    // u.log("Spawn " + spawn.name + " takes " + job.id, u.LOG_INFO);
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

    // console.log( "sortJobsByPriority: " + job_ids );
    return job_ids;
}

function detectRecoveryMode(rm) {
    rm.memory.recoveryMode = (rm.memory.balance.c1.curCount + rm.memory.balance.c2.curCount == 0) ? 1 : 0;
    if(rm.memory.recoveryMode) {
	u.log("Roome " + rm.name + " in RECOVERY MODE", u.LOG_WARN);
    }
}

function countTotalJobsCapacity(jobs) {
    let count = 0;
    let pri = 10000;
    for(let id in jobs) {
	let cjob = f.make(jobs[id], null);
	let capacity = cjob.getCapacity();
	let curCount = cjob.getCount();
	count = count + capacity;

	if(capacity > curCount) {
	    // find min priority
	    let pri1 = cjob.getPriority() + curCount;
	    if(pri1 < pri) pri = pri1;
	}
    }
    return {count: count, priority: pri};
}

// update the creeps balance - count and priority
function nextTickPlanning(rm) {
    {
	let stat = countTotalJobsCapacity(rm.memory.jobs.JobBuilder);
	rm.memory.balance.b1.count = _.min([3, stat.count]);
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
    /*
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
    */

    {
	let minerJobs = rm.memory.jobs.JobMiner;
	let carrierJobs = rm.memory.jobs.JobCarrier;
	let curMinerWorkCnt = getDesign('d_h1', null, rm)[WORK];
	let pri = 0;
	for(let hp_id in rm.memory.harvPoints) {
	    //let hp = rm.memory.harvPoints;
	    let chp = f.make(rm.memory.harvPoints[hp_id], null);
	    if(!minerJobs[hp_id]) {
		let job = { id : hp_id,
			    cname: 'JobMiner',
			    taken_by_id: null,
			    priority : pri,
			    capacity: 1,
			    curPower: 0,
			    reqQta: 10,
			    res_id: null,
			    res_pos : chp.makeRef(),
			    maxCapacity: chp.d.maxCapacity,
			    drop_id: null,
			    drop_name: 'Spawn1',
			  };
		minerJobs[hp_id] = job;
	    } /*else {
		let job = minerJobs[hp_id];

		if(rm.memory.recoveryMode) {
		    job.capacity = 1;
		} else {
		    let cjob = f.make(job, null);
		    
		    if(cjob.getCount() === cjob.getCapacity()) {
			if(cjob.d.curPower < 10) {
			    cjob.d.capacity++;
			} else if (cjob.getCount() > 0) {
			    let cr_id = cjob.getFirstWorkerId(); //Object.keys(cjob.d.taken_by_id)[0];
			    let cr = Game.getObjectById(cr_id);
			    let cr_pwr = cr.memory.design[WORK] * 2;
			    
			    if(cjob.d.curPower - cr_pwr > 10) {
				cjob.d.capacity--;
			    }
			}
		    }
		}

		if(chp.d.maxCapacity && (chp.d.maxCapacity < job.capacity))
		    job.capacity = chp.d.maxCapacity;
	    } */

	    // let cminerJob = f.make(minerJobs[hp_id], null);

	    let car_job_id = 'carry_'+hp_id;
	    if(!carrierJobs[car_job_id]) {
		let job = { id : car_job_id,
			    cname: 'JobCarrier',
			    taken_by_id: null,
			    priority : pri,
			    capacity: 0, // todo
			    curPower: 0,
			    reqQta: 0,
			    take_from :  chp.makeRef(),
			    take_to : rm.memory.storagePoint,
			  };
		carrierJobs[car_job_id] = job;
	    } /*else {
		let job = carrierJobs[car_job_id];
		let cjob = f.make(job, null);
		
		if(job.avg_trip_time) {
		    let miningPower = minerJobs[hp_id].curPower;
		    if(miningPower>10) miningPower = 10;
		    if(!cjob.d.curPower) cjob.d.curPower = 0;
		    let curCarrierPower = cjob.d.curPower / job.avg_trip_time / 2;
		    
		    if(cjob.getCount() === cjob.getCapacity()) {
			if(curCarrierPower < miningPower) {
			    cjob.d.capacity++;
			} else if (cjob.getCount() > 0) {
			    let cr_id = cjob.getFirstWorkerId(); //Object.keys(cjob.d.taken_by_id)[0];
			    let cr = Game.getObjectById(cr_id);
			    let cr_pwr = cr.memory.design[CARRY] * 50 / job.avg_trip_time / 2;
			    // console.log( "cr_pwr = " + cr_pwr );
			    
			    if((curCarrierPower - cr_pwr) > (1.1 * miningPower)) {
				cjob.d.capacity--;
			    }
			}
		    }		

		    // console.log( "carrier calc " + car_job_id +", " + miningPower +", " + curCarrierPower +", " + cjob.d.capacity );
		} else {
		    if(cjob.getCapacity() == 0 && cminerJob.getCount() > 0) {
			cjob.d.capacity = 1;
		    }
		}
	    } */
	    pri += 5;
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
			    priority : 100,
			    take_from: rm.memory.storagePoint, //rm.memory.harvPoints.hp1,
			    take_to: { cname: 'AddrBuilding',
				       roomName: rm.name,
				       tgt_id: con.id },
			  };

		rm.memory.jobs.JobBuilder[con_job_id] = job;
	    }
	}
    }

    let con_lst = rm.find(FIND_MY_CONSTRUCTION_SITES);
    for(let con_i in con_lst) {
	let con = con_lst[con_i];
	// let con_capacity = getConstrBuildingCapacity(rm, con);
	let con_job_id = 'con_' + con.id;
	if(!rm.memory.jobs.JobBuilder[con_job_id]) {
	    let job = { id: con_job_id,
			cname: 'JobBuilder',
			taken_by_id: null,
			capacity: 0,
			priority : 150,
			take_from: rm.memory.storagePoint, //rm.memory.harvPoints.hp1,
			take_to: { cname: 'AddrBuilding',
				   roomName: rm.name,
				   tgt_id: con.id },
		      };

	    rm.memory.jobs.JobBuilder[con_job_id] = job;
	}
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
	    else if(qta > 30) qta = 30;
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
	let oneJobQta = 20;
	while(i<job_ids.length) {
	    let id = job_ids[i++];
	    let job = jobs[id];
	    let cjob = f.make(job, null);
	    if(id === 'ctrlr') {
		job.reqQta = stats.enCtrlQta;
	    } else {
		if(quota > oneJobQta) {
		    job.reqQta = oneJobQta;
		    quota -= oneJobQta;
		} else {
		    job.reqQta = quota;
		    quota = 0;
		}
	    }

	    cjob.updateCapacity(rm);

	    /*
	    // 
	    {
		let car_job_id = 'help_' + id;
		let carJob = carJobs[car_job_id];
		if(carJob) {
		    carJob.reqQta = job.reqQta;
		    carJob.updateCapacity(rm);
		}
	    }
	    */
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
			    cjob.calcPower(rm);
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
    for(let job_id in jobs) {
	let job = jobs[job_id];
	let cjob = f.make(job, null);
	while(cjob.getCount() > cjob.getCapacity()) {
	    let cr_id = cjob.getFirstWorkerId(); //Object.keys(cjob.d.taken_by_id)[0];
	    let cr = Game.getObjectById(cr_id);
	    cjob.unassign(rm ,cr);
	}
    }
}

// 1. Unassign and remove creeps that no longer exist
// 2. If already has a job - keep looking
// 3. Assign a new job, otherwise - start_work()
function assignCreepJobs(rm) {

    // for(let room_idx in Game.rooms) {
    // 	let rm = Game.rooms[room_idx];

    reduceJobs(rm, rm.memory.jobs['JobMiner']);
    reduceJobs(rm, rm.memory.jobs['JobCarrier']);
    reduceJobs(rm, rm.memory.jobs['JobBuilder']);
    reduceJobs(rm, rm.memory.jobs['JobDefender']);

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

    calcRoomStats(rm);
    
    planCreepJobs(rm); // schedule new jobs for builders and carriers
    assignJobQuotas(rm); // assign quotas to jobs
    assignCreepJobs(rm); // creeps get new jobs
    
    nextTickPlanning(rm); // adjust the number of creeps on the balance
    planSpawnJobs(rm);  // // Convert balance into JobSpawn jobs
    assignSpawnJobs(rm);
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

	PathFinder.use(true);
	
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
