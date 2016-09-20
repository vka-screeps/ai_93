var u = require('utils'); 
var configver = require('configver');
var gameRestartCount = 20;

module.exports = {
    updateConfig(memobj) {
	var addObject = memobj.addObject;
	var task = require('task')(memobj);

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
		return setConfig_W53N3();
	    }
	};


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

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp1',
    				     maxCapacity: 3,
				     priority: 1,
				     // postDelete: true,
				   },
				   { cname: 'AddrHarvPoint',
				     id: 'hp1',
				     roomName: room_name,
				     x: 35,
				     y: 20,
				     full: true } 
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp2',
    				     maxCapacity: 1,
				     priority: 5,
				     mayDrop: 1,
				     // postDelete: true,
				   },
				   { cname: 'AddrHarvPoint',
				     id: 'hp2',
				     roomName: room_name,
				     x: 35,
				     y: 2,
				     full: true }
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr1',
				     type: STRUCTURE_TOWER,
				     postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 15,
				     y: 25, }
				);
	    
	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr2',
				     type: STRUCTURE_STORAGE,
				     // postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 29,
				     y: 23, }
				);

	    /*
	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr3',
				     type: STRUCTURE_CONTAINER,
				     // postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 29,
				     y: 24, }
				);
	    */

	    if(!room_mem.storagePoint) {
		room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
						     id: 'sp1',
						     roomName: room_name,
						     x: 29,
						     y: 24,
						     full: true,
						     storage_id: null,
						     isActive: false,
						     backup_point: room_mem.tasks.hp1.pts[0],
						   } );
	    }

	    if(!room_mem.upkeepPoint) {
		room_mem.upkeepPoint = addObject( { cname: 'AddrUpkeep',
						    roomName: room_name,
    						    tgt_id_lst: [],
						  } );
	    }
	    
	    
	    if(!room_mem.balance) {
		room_mem.balance = {
//		    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -10 },  // permanent
//		    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -5 },  // permanent
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
					       priority : 1,
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
		NZInc: 0,
	    };
	}

	function setConfig_W53N3() {

	    let room_name = 'W53N3';
	    if(!Memory.rooms) {
		Memory.rooms = {};
	    }
	    if(!Memory.rooms[room_name]) {
		Memory.rooms[room_name] = {};
	    }
	    let room_mem = Memory.rooms[room_name];

	    initMemVars();
	    initRoomVars(room_name);

	    // quotas
	    room_mem.config = {
		ctrlrShare: 0.1,
		repairShare: 0.1,
		builderShare: 0.8,
		creepCostLimit: 550,
		NZInc: 0,
	    };
	    

	    // room_mem = {};
	    // SIM CONFIG
	    if(!room_mem.harvPoints) {
		room_mem.harvPoints = {};
	    }

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp1',
    				     maxCapacity: 1,
				     priority: 1,
				     extraCapacity: 0,
				     // postDelete: true,
				   },
				   { cname: 'AddrHarvPoint',
				     id: 'hp1',
				     roomName: room_name,
				     x: 22,
				     y: 38,
				     full: true } 
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp2',
    				     maxCapacity: 3,
				     priority: 5,
				     // mayDrop: 1,
				     // postDelete: true,
				   },
				   { cname: 'AddrHarvPoint',
				     id: 'hp2',
				     roomName: room_name,
				     x: 18,
				     y: 24,
				     full: true }
				);


	    if(!room_mem.storagePoint) {
		room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
						     id: 'sp1',
						     roomName: room_name,
						     x: 18,
						     y: 36,
						     full: true,
						     storage_id: null,
						     isActive: false,
						     backup_point: room_mem.tasks.hp1.pts[0],
						   } );
	    }

	    if(!room_mem.upkeepPoint) {
		room_mem.upkeepPoint = addObject( { cname: 'AddrUpkeep',
						    roomName: room_name,
    						    tgt_id_lst: [],
						  } );
	    }

	    /*
	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr1',
				     type: STRUCTURE_TOWER,
				     // postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 28,
				     y: 27, }
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr2',
				     type: STRUCTURE_STORAGE,
				     // postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 29,
				     y: 31, }
				);
	    */

	    /*

	    

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr3',
				     type: STRUCTURE_CONTAINER,
				     // postDelete: true, 
				   },
				   { cname: 'AddrPos',
				     roomName: room_name,
				     x: 29,
				     y: 24, }
				);
				*/
	    
	    
	    
	    if(!room_mem.balance) {
		room_mem.balance = {
//		    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -10 },  // permanent
//		    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -5 },  // permanent
		    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
		    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
		    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
		    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
		    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
		    //	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
		};


		room_mem.wait_point = { cname: 'AddrPos',
					roomName: room_name,
					x: 15,
					y: 35,
					isWaitPoint: true };

		room_mem.jobs = {
		    'JobMiner' : {},
		    'JobCarrier' : { 'jc1' : { id : 'jc1',
					       cname: 'JobCarrier',
					       taken_by_id: null,
					       priority : 1,
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

	}

	function deleteAll() {
	    Memory = {
		rooms: {},
	    };
	}

	var newVersion = configver.configVersion;
	if(!Memory.configVer || Memory.configVer != newVersion) {
	    Memory.configVer = newVersion;
	    console.log('Apply Config - ' + newVersion);
	    setConfig()
	}
    },

    maybeResetMemory() {
	if(!Memory.gameRestartCount || Memory.gameRestartCount != gameRestartCount) {
	    RawMemory.set('{ "rooms": {}, "creeps": {} }' );
	    Memory = JSON.parse(RawMemory.get());
	    Memory.gameRestartCount = gameRestartCount;
	    RawMemory.set(JSON.stringify(Memory));
	    console.log("Reset Memory - " + JSON.stringify(Memory));
	    return true;
	}
	return false;
    }
};
