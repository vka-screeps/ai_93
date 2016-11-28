var u = require('utils'); 
var configver = require('configver');
var gameRestartCount = 29;

module.exports = {
    updateConfig(memobj) {
	var addObject = memobj.addObject;
	var task = require('task')(memobj);

	function setConfig_game() 
	{
	    let room_name = 'W72N57';

	    initMemVars();
	    initRoomVars(room_name);


	    let room_mem = Memory.rooms[room_name];

	    // quotas
	    room_mem.config = {
		ctrlrShare: 0.0,
		repairShare: 0.1,
		builderShare: 0.9,
		creepCostLimit: 1000,
		NZInc: 0,
	    };
	    
	    // SIM CONFIG
	    function MyAddrHarvPoint(x,y) { return { cname: 'AddrHarvPoint',
						     roomName: room_name,
						     x: x,
						     y: y,
						     full: true }; };
	    
	    function MyAddrPos(x,y) { return { cname: 'AddrPos',
					       roomName: room_name,
					       x: x,
					       y: y }; };

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp1',
    				     maxCapacity: 3,
				     priority: 1,
				     extraCapacity: 0,
				     // autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 4, 42 ),
				     MyAddrPos(5, 41) ]
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp2',
    				     maxCapacity: 3,
				     priority: 5,
				     mayDrop: true,
				     extraCapacity: 0,
				     // autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 5, 20 ),
				     MyAddrPos(5, 21)]
				);


	    if(!room_mem.storagePoint) {
		room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
						     id: 'sp1',
						     roomName: room_name,
						     x: 8,
						     y: 37,
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
		    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
		    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
		    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
		    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
		    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
		};


		room_mem.wait_point = { cname: 'AddrPos',
					roomName: room_name,
					x: 11,
					y: 29,
					isWaitPoint: true };

		room_mem.jobs = {
		    'JobMiner' : {},
		    'JobCarrier' : { 'jc1' : { id : 'jc1',
					       cname: 'JobCarrier',
					       taken_by_id: null,
					       priority : 1,
					       capacity : 1,
					       reqQta: 1,
					       take_from :  room_mem.storagePoint,
					       take_to : { cname: 'AddrBuilding',
							   roomName: room_name,
							   spawnName: 'Spawn1', },
					     },
				     
				   },
		    'JobDefender' : {    },
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

	function setConfig_game_template() {

	    let room_name = 'template';

	    initMemVars();
	    initRoomVars(room_name);


	    let room_mem = Memory.rooms[room_name];

	    // quotas
	    room_mem.config = {
		ctrlrShare: 0.0,
		repairShare: 0.1,
		builderShare: 0.9,
		creepCostLimit: 1000,
		NZInc: 0,
	    };
	    
	    // SIM CONFIG
	    function MyAddrHarvPoint(x,y) { return { cname: 'AddrHarvPoint',
						     roomName: room_name,
						     x: x,
						     y: y,
						     full: true }; };
	    
	    function MyAddrPos(x,y) { return { cname: 'AddrPos',
					       roomName: room_name,
					       x: x,
					       y: y }; };

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp1',
    				     maxCapacity: 3,
				     priority: 1,
				     extraCapacity: 0,
				     // autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 12, 11 ),
				     MyAddrPos(13, 12) ]
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp2',
    				     maxCapacity: 2,
				     priority: 5,
				     mayDrop: true,
				     extraCapacity: 0,
				     // autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 42, 25 ),
				     MyAddrPos(41, 26)]
				);


	    if(!room_mem.storagePoint) {
		room_mem.storagePoint = addObject( { cname: 'AddrStoragePoint',
						     id: 'sp1',
						     roomName: room_name,
						     x: 14,
						     y: 16,
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
		    d1: {id:'d1', count: 0, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: -1 },  // permanent
		    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
		    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
		    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
		    bal_claim: {id:'bal_claim', count: 0, curCount: 0, design: 'd_claim', role: 'JobClaim' },
		};


		room_mem.wait_point = { cname: 'AddrPos',
					roomName: room_name,
					x: 17,
					y: 21,
					isWaitPoint: true };

		room_mem.jobs = {
		    'JobMiner' : {},
		    'JobCarrier' : { 'jc1' : { id : 'jc1',
					       cname: 'JobCarrier',
					       taken_by_id: null,
					       priority : 1,
					       capacity : 1,
					       reqQta: 1,
					       take_from :  room_mem.storagePoint,
					       take_to : { cname: 'AddrBuilding',
							   roomName: room_name,
							   spawnName: 'Spawn1', },
					     },
				     
				   },
		    'JobDefender' : {    },
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


	var initMemVars = function() {
	    if(!Memory.next_id)
		Memory.next_id = 1;
	    if(!Memory.next_creep_id)
		Memory.next_creep_id = 1;
	};


	function initRoomVars(room_name) {
	    if(!Memory.rooms[room_name]) {
		Memory.rooms[room_name] = {};
	    }
	    
            if(!Memory.rooms[room_name].NZ)
		Memory.rooms[room_name].NZ = 0;

            if(!Memory.rooms[room_name].ignored_const)
		Memory.rooms[room_name].ignored_const = {};
	}


	function setConfig() {

	    if( Game.rooms.sim ) {
		console.log("Sim mode detected!");
		return setConfigSim();
	    } else {
		return setConfig_game();
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


	function MaybeAddBalanceLine( hash, obj ) {
	    if(!hash[obj.id]) {
		hash[obj.id] = obj;
	    }
	}


	function setConfigSim() {

	    let room_name = 'sim';

	    initMemVars();
	    initRoomVars(room_name);


	    let room_mem = Memory.rooms[room_name];

	    // quotas
	    room_mem.config = {
		ctrlrShare: 0.8,
		repairShare: 0.1,
		builderShare: 0.1,
		creepCostLimit: 1000,
		NZInc: 0,
	    };
	    
	    // SIM CONFIG
	    function MyAddrHarvPoint(x,y) { return { cname: 'AddrHarvPoint',
						     roomName: room_name,
						     x: x,
						     y: y,
						     full: true }; };
	    
	    function MyAddrPos(x,y) { return { cname: 'AddrPos',
					       roomName: room_name,
					       x: x,
					       y: y }; };

 	    task.addOrUpdateTask( room_name,
				   { cname: 'TaskFightKeeper',
				     id: 'fk1',
    				     maxCapacity: 3,
				     capacity: 1,
				     priority: 500,
				     postDelete: true,
				   },
				  [ MyAddrPos(3, 33) ]
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp1',
    				     maxCapacity: 3,
				     priority: 1,
				     extraCapacity: 0,
				     autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 35, 20 ),
				     MyAddrPos(34, 21)  ]
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp2',
    				     maxCapacity: 1,
				     priority: 5,
				     mayDrop: 1,
				     extraCapacity: 0,
				     autoContainers: true,
				     // postDelete: true,
				   },
				   { cname: 'AddrHarvPoint',
				     roomName: room_name,
				     x: 35,
				     y: 2,
				     test: true,
				     full: true }
				);

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskMining',
				     id: 'hp3',
    				     maxCapacity: 1,
				     priority: 10,
				     extraCapacity: 0,
				     autoContainers: true,
				     // postDelete: true,
				   },
				   [ MyAddrHarvPoint( 43, 44 )  ]
				);	    

	    task.addOrUpdateTask(  room_name,
				   { cname: 'TaskConstr',
				     id: 'constr1',
				     type: STRUCTURE_TOWER,
				     // postDelete: true, 
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

	    MaybeAddBalanceLine( room_mem.balance, {id:'bal_melee', count: 0, curCount: 0, design: 'd_melee', role: 'JobMelee' } );
	    MaybeAddBalanceLine( room_mem.balance, {id:'bal_archer', count: 0, curCount: 0, design: 'd_archer', role: 'JobArcher' } );
	    MaybeAddBalanceLine( room_mem.balance, {id:'bal_healer', count: 0, curCount: 0, design: 'd_healer', role: 'JobHealer' } );
	    MaybeAddBalanceLine( room_mem.balance, {id:'bal_ram', count: 0, curCount: 0, design: 'd_ram', role: 'JobRam' } );

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
	    /*
	    RawMemory.set('{ "rooms": {}, "creeps": {} }' );
	    Memory = JSON.parse(RawMemory.get());
	    Memory.gameRestartCount = gameRestartCount;
	    RawMemory.set(JSON.stringify(Memory));
	    */
	    Memory.rooms = {};
	    Memory.creeps = {};
	    Memory.spawns = {};
	    delete Memory.objects;
	    Memory.gameRestartCount = gameRestartCount;
	    Memory.next_creep_id = 1;
	    console.log("Memory is reset");
	    return true;
	}
	return false;
    }
};
