var u = require('utils');
var configver = require('configver');

module.exports = {
    

    updateConfig() {
	var newVersion = configver.configVersion;
	if(Memory.configVer != newVersion) {
	    Memory.configVer = newVersion;
	    console.log('Apply Config - ' + newVersion);
	    setConfig()
	}
    },
};

var initMemVars = function() {
    if(!Memory.next_id)
	Memory.next_id = 1;
    if(!Memory.next_creep_id)
	Memory.next_creep_id = 1;
};


function initRoomVars(name) {
        if(!Memory.rooms[name].NZ)
	    Memory.rooms[name].NZ = 0;
}


function setConfig() {

    if( Game.rooms.sim ) {
	console.log("Sim mode detected!");
	return setConfigSim();
    } else {
	setConfigGame();
	setConfigGame2()
    }
};

function addObject( obj ) {

    if(!Memory.objects) {
	Memory.objects = {
	    next_id: 1
	};
    }
    let objects = Memory.objects;

    let next_id = 'id_' + objects.next_id++;
    obj.obj_id = next_id;
    objects[next_id] = obj;
    return { cname: 'ObjRef',
	     obj_id: next_id };
}

/*
// Dangerous
function clearDuplicatesFor(id) {
    try {
	let objects = Memory.objects;
	let keys = Object.keys(objects);

	keys = _.filter( keys, function (k) {
	    try {
		return (id === objects[k].id);
	    } catch(err){};
	    return false;
	} );

	if(keys.length > 1) {
	    keys.splice(keys.length-1, 1); // remove last
	    console.log('Duplicates: ' + keys);
	    _.forEach(keys, (v, i, c) => { delete objects[v];  } );
	} else {
	    console.log('No duplicates: ' + keys);
	}
    } catch(err) {
	console.log("Error: " + err);
    }
}
*/

function findObject(obj) {
    let objects = Memory.objects;
    let o2 = _.find( objects, function(o2) {
	try {
	    return (obj.id === o2.id) && (obj.roomName === o2.roomName);
	} catch(err){};
	return false;
    } );
    return o2;
}

function addOrUpdateObject( hash, obj ) {
    let o2 = findObject(obj);

    if(!hash[obj.id]) {
	if(!o2) {
	    hash[obj.id] = addObject(obj);
	} else {
	    console.log("Error: object " + obj.id+", " + obj.roomName + " already exists");
	}
    } else {
	if(o2) {
	    for(let k of Object.keys(obj)) {
		if(typeof o2[k] === 'undefined' || o2[k] !== obj[k]) {
		    console.log("Change property of "+o2.obj_id +" " + obj.id + "." +k+"=" +obj[k]);
		    o2[k] = obj[k];
		}
	    }
	} else {
	    console.log("Error: can't find object " + obj.id);
	}
    }
}

function postDeleteObject( hash, obj ) {
    if(!hash[obj.id]) {
	return; // already deleted
    } else {
	obj.postDelete = true;
	addOrUpdateObject( hash, obj );
    }
}


function claimARoom(room_mem, rn) {
    if(!room_mem.claimRooms) {
	room_mem.claimRooms = {};
    }	
    if( !room_mem.claimRooms[rn] ) {
	room_mem.claimRooms[rn] = 'claim';
    }
}



function setConfigSim() {

    let room_name = 'sim';
    if(!Memory.rooms[room_name]) {
	Memory.rooms[room_name] = {};
    }
    let room_mem = Memory.rooms[room_name];

    initMemVars();
    initRoomVars(room_name);

    // room_mem = {};
    // SIM CONFIG
    if(!room_mem.harvPoints) {
	room_mem.harvPoints = {};
    }

    if(!room_mem.harvPoints.hp1)
    {
	room_mem.harvPoints.hp1 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp1',
					      roomName: room_name,
					      x: 35,
					      y: 20,
					      full: true });
    }

    if(!room_mem.harvPoints.hp2) {
	room_mem.harvPoints.hp2 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp2',
					      roomName: room_name,
					      maxCapacity: 1,
					      x: 35,
					      y: 2,
					      full: true });
    }




    if(!room_mem.harvPoints.hp3) {
	room_mem.harvPoints.hp3 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp3',
					      roomName: room_name,
					      // maxCapacity: 2,
					      x: 43,
					      y: 44,
					      full: true });
    }

    if(!room_mem.scavengePoints) {
	room_mem.scavengePoints = {};
    }

    postDeleteObject(
//    addOrUpdateObject(
	room_mem.scavengePoints,
	{ cname: 'AddrFreeRoom',
    	  id: 'scavengep1',
    	  roomName: 'sim',
    	  maxCapacity: 4,
    	  x: 32,
    	  y: 25,
	  full: true } );

    // claimARoom(room_mem, 'sim');

    if(!room_mem.upkeepPoint) {
	room_mem.upkeepPoint = addObject( { cname: 'AddrUpkeep',
					    roomName: room_name,
    					    tgt_id_lst: [],
					  } );
    }
    
    if(!room_mem.storagePoint) {
	room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
					     id: 'sp1',
					     roomName: room_name,
					     x: 29,
					     y: 24,
					     full: true,
					     storage_id: null,
					     isActive: false,
					     backup_point: room_mem.harvPoints.hp1,
					   } );
    }
    
    if(!room_mem.balance) {
	room_mem.balance = {
	    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -10 },  // permanent
	    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -5 },  // permanent
	    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
	    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
	    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
	    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
	    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
	    //	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
	};


	room_mem.wait_point = { cname: 'AddrPos',
				roomName: room_name,
				x: 25,
				y: 30,
				isWaitPoint: true };

	room_mem.jobs = {
	    'JobMiner' : {},
	    'JobCarrier' : { 'jc1' : { id : 'jc1',
				       cname: 'JobCarrier',
				       taken_by_id: null,
				       priority : -1,
				       capacity : 1,
				       reqQta: 1,
				       // take_from :  room_mem.harvPoints.hp1, // copy ref
				       take_from :  room_mem.storagePoint,
				       take_to : { cname: 'AddrBuilding',
						   roomName: room_name,
						   spawnName: 'Spawn1', },
				     },
			     
			   },
	    'JobDefender' : {/* 'jd1': { id: 'jd1',
				       cname: 'JobDefender',
				       taken_by_id: null,
				       priority : 0,
				       def_pos : {cname: 'AddrPos',
						  roomName: room_name,
						  x: 29,
						  y: 27 },
				     },
			      'jd2': { id: 'jd2',
				       cname: 'JobDefender',
				       taken_by_id: null,
				       priority : 0,
				       def_pos : {cname: 'AddrPos',
						  roomName: room_name,
						  x: 27,
						  y: 25 },
				     },
			      'jd3': { id: 'jd3',
				       cname: 'JobDefender',
				       taken_by_id: null,
				       priority : 0,
				       def_pos : {cname: 'AddrPos',
						  roomName: room_name,
						  x: 27,
						  y: 25 },
				     },*/ 
			    },
	};


	room_mem.creeplist = {};
	room_mem.recoveryMode = true;

	for(let cr_name in room_mem.creeplist) {
	    Memory.creeps[cr_name].role.job_id = null
	    Memory.creeps[cr_name].workStatus = null;
	}
    }

    if(!room_mem.stats) {
	room_mem.stats = {
	    NZ: 0,
	    enTotal: 0, // energy in the storage
	    hasStorage: false, 
	    enProd: 0, // mining pet turn
	    enTotalQta: 0,
	    enCtrlQta: 0, // controller upgrade quote
	    enSpawnQta: 0, // spawner quota
	    enBldQta: 0, // builders quota
	};
    }

    // quotas
    room_mem.config = {
	ctrlrShare: 0.2,
	repairShare: 0.1,
	builderShare: 0.7,
	creepCostLimit: 550,
    };

    /*
    room_mem.strategy_data =[
	{ role_id : 'h1', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }
	,{ role_id : 'h2', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }	
	, { role_id : 'free', role : 'guard', count : 1, body : [TOUGH, TOUGH, ATTACK, ATTACK, MOVE]
	    , props : { isMilitary:1 }
	    , autoExpand: 1}
	,{ role_id : 'h3', role : 'harv', count : 1, body : [ WORK, WORK, MOVE] }
    ];

    room_mem.strategy = 'str_maintain_creeps';
    room_mem.str_data = {	curRoleTable : [],
					curGoals : {},
					specialization : "growth"
				   };
    */
}

function setConfigGame()
{
    let room_name = 'W43S54';
    console.log( 'setConfigGame for room ' + room_name );
    if(!Memory.rooms[room_name]) {
	Memory.rooms[room_name] = {};
    }
    let room_mem = Memory.rooms[room_name];

    initMemVars();
    initRoomVars(room_name);

    // room_mem = {};
    // SIM CONFIG
    if(!room_mem.harvPoints) {
	room_mem.harvPoints = {};
    }

    if(!room_mem.harvPoints.hp1)
    {
	room_mem.harvPoints.hp1 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp1',
					      roomName: room_name,
					      x: 34,
					      y: 18,
					      full: true });
    }

    if(!room_mem.harvPoints.hp2) {
	room_mem.harvPoints.hp2 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp2',
					      roomName: room_name,
					      maxCapacity: 2,
					      x: 29,
					      y: 13,
					      full: true });
    }

    if(!room_mem.harvPoints.hp3 || room_mem.harvPoints.hp3 === 'delete') {
    	room_mem.harvPoints.hp3 = addObject({ cname: 'AddrHarvPoint',
    					      id: 'hp3',
    					      roomName: 'W42S54',
    					      maxCapacity: 2,
					      res_id: '579fa8f80700be0674d2e934',
    					      x: 3,
    					      y: 40,
    					      full: true });
    }
    // room_mem.harvPoints.hp3 = 'delete';

    if(!room_mem.scavengePoints) {
	room_mem.scavengePoints = {};
    }


    // TODO - user obj.id and obj.roomName for findObject and deleteObject
    // clearDuplicatesFor('scavengep1');
    postDeleteObject(
	room_mem.scavengePoints,
	{ cname: 'AddrFreeRoom',
    	  id: 'scavengep1',
    	  roomName: 'W43S53',
    	  maxCapacity: 2,
	  demolish: true,
    	  x: 32,
    	  y: 25,
    	  full: true });

/*
    // ???
    addOrUpdateTask(
	room_name,
	{ cname: 'AddrFreeRoom',
    	  id: 'scavengep3',
    	  roomName: 'W43S53',
    	  x: 32,
    	  y: 25,
    	  full: true,
	  task: 'demolish',
    	  maxCapacity: 2,
	} );

    addOrUpdateTask(
	room_name,
	{ cname: 'Task',
    	  id: 'task1',
	  task: 'reserve',
    	  roomName: 'W43S53',
	} );

    addOrUpdateTask(
	room_name,
	{ cname: 'AddrPos',
	  roomName: room_name,
	  x: 25,
	  y: 30,
	  task: 'guard',
	}
    );

*/


    // room_mem.scavengePoints.scavengep1 = 'delete';

    /*
    clearDuplicatesFor('scavengep2');
    postDeleteObject(
	room_mem.scavengePoints,
	{ cname: 'AddrFreeRoom',
    	  id: 'scavengep2',
    	  roomName: 'W43S52',
    	  maxCapacity: 5,
    	  x: 19,
    	  y: 34,
    	  full: true });
    */


    
    // room_mem.scavengePoints.scavengep2 = 'delete';

    // room_mem.scavengePoints.scavengep2.maxCapacity=5;

    // Claim rooms
    claimARoom(room_mem, 'W43S55');

    //room_mem.extraConstructionSites=['57c34574fe945e772e27833f'];
    room_mem.extraConstructionSites=[];
    room_mem.extraConstructionRooms=[]; //['W43S55'];
    room_mem.extraEnergyToRoom=['W43S55'];

    if(!room_mem.upkeepPoint) {
	room_mem.upkeepPoint = addObject( { cname: 'AddrUpkeep',
					    roomName: room_name,
    					    tgt_id_lst: [],
					  } );
    }
    
    if(!room_mem.storagePoint) {
	room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
					     id: 'sp1',
					     roomName: room_name,
					     x: 28,
					     y: 20,
					     full: true,
					     storage_id: null,
					     isActive: false,
					     backup_point: room_mem.harvPoints.hp1,
					   } );
    }
    
    if(!room_mem.balance) {
	room_mem.balance = {
	    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -10 },  // permanent
	    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -5 },  // permanent
	    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
	    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
	    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
	    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
	    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
	    //	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
	};


	room_mem.wait_point = { cname: 'AddrPos',
				roomName: room_name,
				x: 22,
				y: 28,
				isWaitPoint: true };

	room_mem.jobs = {
	    'JobMiner' : {},
	    'JobCarrier' : { 'jc1' : { id : 'jc1',
				       cname: 'JobCarrier',
				       taken_by_id: null,
				       priority : -1,
				       capacity : 1,
				       reqQta: 1,
				       // take_from :  room_mem.harvPoints.hp1, // copy ref
				       take_from :  room_mem.storagePoint,
				       take_to : { cname: 'AddrBuilding',
						   roomName: room_name,
						   spawnName: 'Spawn1', },
				     },
			     
			   },
	    'JobDefender' : {
		// 'jd1': { id: 'jd1',
		// 	 cname: 'JobDefender',
		// 	 taken_by_id: null,
		// 	 priority : 0,
		// 	 def_pos : {cname: 'AddrPos',
		// 		    roomName: room_name,
		// 		    x: 29,
		// 		    y: 27 },
		//        },
		// 'jd2': { id: 'jd2',
		// 	 cname: 'JobDefender',
		// 	 taken_by_id: null,
		// 	 priority : 0,
		// 	 def_pos : {cname: 'AddrPos',
		// 		    roomName: room_name,
		// 		    x: 27,
		// 		    y: 25 },
		//        },
		// 'jd3': { id: 'jd3',
		// 	 cname: 'JobDefender',
		// 	 taken_by_id: null,
		// 	 priority : 0,
		// 	 def_pos : {cname: 'AddrPos',
		// 		    roomName: room_name,
		// 		    x: 27,
		// 		    y: 25 },
		//        },
	    },
	    'JobBuilder' : {},
	    'JobClaim' : {},
	};


	room_mem.creeplist = {};
	room_mem.recoveryMode = true;

	for(let cr_name in room_mem.creeplist) {
	    Memory.creeps[cr_name].role.job_id = null
	    Memory.creeps[cr_name].workStatus = null;
	}

    }

    // addBalanceLine( room_mem.balance, bal_claim: {id:'bal_dismantle', count: 0, curCount: 0, design: 'd_dismantle', role: 'JobDismantle' } );

    // Add claim role
    if(!room_mem.balance.bal_claim) {
	room_mem.balance.bal_claim = {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' };
	room_mem.jobs.JobClaim = {};
    }

    if(!room_mem.stats) {
	room_mem.stats = {
	    NZ: 0,
	    enTotal: 0, // energy in the storage
	    hasStorage: false, 
	    enProd: 0, // mining pet turn
	    enTotalQta: 0,
	    enCtrlQta: 0, // controller upgrade quote
	    enSpawnQta: 0, // spawner quota
	    enBldQta: 0, // builders quota
	};
    }

    // quotas
    room_mem.config = {
	ctrlrShare: 0.2,
	repairShare: 0.1,
	builderShare: 0.7,
	creepCostLimit: 600,
	NZInc: 0.5,
    };

    /*
    room_mem.strategy_data =[
	{ role_id : 'h1', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }
	,{ role_id : 'h2', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }	
	, { role_id : 'free', role : 'guard', count : 1, body : [TOUGH, TOUGH, ATTACK, ATTACK, MOVE]
	    , props : { isMilitary:1 }
	    , autoExpand: 1}
	,{ role_id : 'h3', role : 'harv', count : 1, body : [ WORK, WORK, MOVE] }
    ];

    room_mem.strategy = 'str_maintain_creeps';
    room_mem.str_data = {	curRoleTable : [],
					curGoals : {},
					specialization : "growth"
				   };
    */
}

function setConfigGame2()
{
    let room_name = 'W43S55';
    console.log( 'setConfigGame for room ' + room_name );
    if(!Memory.rooms[room_name]) {
	Memory.rooms[room_name] = {};
    }
    let room_mem = Memory.rooms[room_name];

    initMemVars();
    initRoomVars(room_name);

    // room_mem = {};
    // SIM CONFIG
    if(!room_mem.harvPoints) {
	room_mem.harvPoints = {};
    }

    if(!room_mem.harvPoints.hp1)
    {
	room_mem.harvPoints.hp1 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp1',
					      roomName: room_name,
					      x: 20,
					      y: 29,
					      full: true });
    }

    if(!room_mem.harvPoints.hp2) {
	room_mem.harvPoints.hp2 = addObject({ cname: 'AddrHarvPoint',
					      id: 'hp2',
					      roomName: room_name,
					      maxCapacity: 1,
					      x: 46,
					      y: 37,
					      full: true });
    }


    if(!room_mem.scavengePoints) {
	room_mem.scavengePoints = {};
    }

    // Claim rooms
    // claimARoom(room_mem, 'W43S55');
    

    if(!room_mem.upkeepPoint) {
	room_mem.upkeepPoint = addObject( { cname: 'AddrUpkeep',
					    roomName: room_name,
    					    tgt_id_lst: [],
					  } );
    }
    
    if(!room_mem.storagePoint) {
	room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
					     id: 'sp1',
					     roomName: room_name,
					     x: 20,
					     y: 22,
					     full: true,
					     storage_id: null,
					     isActive: false,
					     backup_point: room_mem.harvPoints.hp1,
					   } );
    }
    
    if(!room_mem.balance) {
	room_mem.balance = {
	    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -10 },  // permanent
	    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -5 },  // permanent
	    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
	    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
	    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
	    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
	    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
	    //	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
	};


	room_mem.wait_point = { cname: 'AddrPos',
				roomName: room_name,
				x: 27,
				y: 8,
				isWaitPoint: true };

	room_mem.jobs = {
	    'JobMiner' : {},
	    'JobCarrier' : { 'jc1' : { id : 'jc1',
				       cname: 'JobCarrier',
				       taken_by_id: null,
				       priority : -1,
				       capacity : 1,
				       reqQta: 1,
				       // take_from :  room_mem.harvPoints.hp1, // copy ref
				       take_from :  room_mem.storagePoint,
				       take_to : { cname: 'AddrBuilding',
						   roomName: room_name,
						   spawnName: 'Spawn2', },
				     },
			     
			   },
	    'JobDefender' : {   },
	    'JobBuilder' : {},
	    'JobClaim' : {},
	};

	room_mem.creeplist = {};
	room_mem.recoveryMode = true;

	for(let cr_name in room_mem.creeplist) {
	    Memory.creeps[cr_name].role.job_id = null
	    Memory.creeps[cr_name].workStatus = null;
	}
    }

    if(!room_mem.stats) {
	room_mem.stats = {
	    NZ: 0,
	    enTotal: 0, // energy in the storage
	    hasStorage: false, 
	    enProd: 0, // mining pet turn
	    enTotalQta: 0,
	    enCtrlQta: 0, // controller upgrade quote
	    enSpawnQta: 0, // spawner quota
	    enBldQta: 0, // builders quota
	};
    }

    // quotas
    room_mem.config = {
	ctrlrShare: 0.4,
	repairShare: 0.1,
	builderShare: 0.4,
	creepCostLimit: 600,
	NZInc: 0.3,
    };
}
