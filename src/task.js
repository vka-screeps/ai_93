var u = require('utils');
var _ = require('lodash');


// class TaskClaim extends Task {
//     constructor(d, parent) {
// 	super(d, parent);
//     }
    
//     static cname() { return 'TaskClaim'; }

//     updateJobs(rm) {
// 	// u.log( "updateJobs is not implemented", u.LOG_WARN);
//     }
// }


module.exports = function (memobj) {
    var f = memobj.f;
    var CMemObj = memobj.CMemObj;

    class Task extends CMemObj {
	constructor(d, parent) {
	    super(d, parent);
	}
	
	static cname() { return 'Task'; }


	// {
	// 	job_type: 'JobCarrier',
	// 	job_id: 'carry_123',
	// }
	
	get_cur_jobs(rm) { return []; }
	free_resources(rm) {
	    let d = this.d;
	    if(d.pts) {
		d.pts.forEach( (p) => { memobj.deleteObject(f.make(p, null)); } );
		delete d.pts;
	    }
	}

	job_exists(rm, jb) {
	    let found = false;
	    try {
		found = rm.memory.jobs[jb.job_type][jb.job_id];
	    }catch(err){}
	    return found;
	}

	// leave existing jobs
	filter_job_lst(rm, lst) {
	    let this_ = this;
	    return _.filter(lst, (o) => { return this_.job_exists(rm, o); } );
	}

	putJob(rm, jb, job) {
	    if(this.job_exists(rm, jb))
		throw ("Job already exists " + jb);
	    rm.memory.jobs[jb.job_type][jb.job_id] = job;
	}

	maybeCreateJob(rm) {};
	maybeCompleteJob(rm) {};
	
	updateJobs(rm) {
	    let d = this.d;
	    if(d.postDelete) {
		let job_lst = this.get_cur_jobs(rm);
		job_lst = this.filter_job_lst(rm, job_lst);

		if(job_lst.length>0) {
		    job_lst.forEach( (j)=> {
			let job = rm.memory.jobs[j.job_type][j.job_id];
			if(job) {
			    u.log('closing job ' + j.job_type + ', ' + j.job_id, u.LOG_INFO);
			    rm.memory.jobs[j.job_type][j.job_id].done = true;
			}
		    } );
		} else  {
		    // remove the point
		    this.free_resources(rm);
		    delete rm.memory.tasks[d.id];
		    u.log( "Deleting object " + d.id, u.LOG_INFO );
		}
	    } else {
		// may be create some jobs

		this.maybeCreateJob(rm);
		this.maybeCompleteJob(rm);
	    }	
	}
    };

    memobj.regClasses([Task]);

    function addOrUpdateTask( room_name, tsk, pts ) {
	let tsk_id = 'unknown';
	try {
	    tsk_id = tsk.id;
	    let ctsk = f.make(tsk, null);
	    if(!ctsk) {
		throw ("Invalid task type");
	    }
	    
	    let hash = Game.rooms[room_name].memory;
	    if(!hash.tasks) hash.tasks = {};
	    hash = hash.tasks;

	    let o2 = hash[tsk_id];
	    
	    if(!o2) {
		if(!tsk.postDelete) {
		    // create new task
		    hash[tsk_id] = tsk;
		    if(pts) {
			if( _.isArray(pts) ) {
			    hash[tsk_id].pts = _.map(pts, memobj.addObject);
			} else {
			    hash[tsk_id].pts=[ memobj.addObject(pts) ];
			}
		    }
		}
	    } else {
		// update
		let obj = tsk;
		for(let k of Object.keys(tsk)) {
		    if(typeof o2[k] === 'undefined' || o2[k] !== obj[k]) {
			console.log("Change property of " + obj.id + "." +k+"=" +obj[k]);
			o2[k] = obj[k];
		    }
		}

		// todo -update pts
	    }
	} catch (err) {
	    u.log("Error creating task " + tsk_id + " = " + err, u.LOG_ERR);
	}
    };

    return {
	Task: Task, 
	addOrUpdateTask: addOrUpdateTask,
    };
}
