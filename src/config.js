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
	return setConfigGame();
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
	    h1: {id:'h1', count: 1, curCount: 0, design: 'd_h0', role: 'JobMiner', priority: -2 },  // permanent
	    c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier', priority: -1 },  // permanent
	    d1: {id:'d1', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender', priority: 1 },  // permanent
	    h2: {id:'h2', count: 0, curCount: 0, design: 'd_h1', role: 'JobMiner' },
	    c2: {id:'c2', count: 0, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
	    b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },
	    //	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
	};


	room_mem.wait_point = {cname: 'AddrPos',
			       roomName: room_name,
			       x: 25,
			       y: 30 };

	room_mem.jobs = {
	    'JobMiner' : {},
	    'JobCarrier' : { 'jc1' : { id : 'jc1',
				       cname: 'JobCarrier',
				       taken_by_id: null,
				       priority : 0,
				       capacity : 1,
				       // take_from :  room_mem.harvPoints.hp1, // copy ref
				       take_from :  room_mem.storagePoint,
				       take_to : { cname: 'AddrBuilding',
						   roomName: room_name,
						   spawnName: 'Spawn1', },
				     },
			     
			   },
	    'JobDefender' : { 'jd1': { id: 'jd1',
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
				     },
			    },
	    'JobBuilder' : {},
	};


	room_mem.creeplist = {};
	room_mem.recoveryMode = true;

	for(let cr_name in room_mem.creeplist) {
	    Memory.creeps[cr_name].role.job_id = null
	    Memory.creeps[cr_name].workStatus = null;
	}

    }

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

function setConfigGame() {
}

