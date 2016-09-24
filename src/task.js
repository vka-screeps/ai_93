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

	getJob(rm, jb) {
	    if(!this.job_exists(rm, jb))
		throw ("Job doesn't exists " + jb);
	    return rm.memory.jobs[jb.job_type][jb.job_id];
	}

	get_cur_jobs(rm) {
	    return [];
	}

	maybeWorkOnTask(rm) {}
	maybeUpdateJob(rm) {}
	
	maybeCreateJob(rm) {
	    let lst  = this.get_cur_jobs(rm);
	    let this_ = this;
	    let createdSomeJobs = false;
	    lst.forEach( (jb)=> {
		try {
		    if(!this_.job_exists(rm, jb) && !jb.done) {
			u.log('creating job ' + jb.job_type + ', ' + jb.job_id, u.LOG_INFO);
			
			this_.putJob( rm,
				      jb,
				      f.findClass(jb.job_type).createFromTask(rm, jb.job_id, this_) );
			createdSomeJobs = true;
		    }

		}catch(err){
		    u.log("Error in maybeCreateJob - " + jb + ', ' + err, u.LOG_ERR);
		}
	    } );

	    return createdSomeJobs;
	}
	
	maybeCompleteJob(rm) {
	    let lst  = this.get_cur_jobs(rm);
	    let this_ = this;
	    lst.forEach( (jb)=> {
		try {
		    if(!jb.done) {
			let job = this_.getJob(rm, jb);
			if(!job || job.done) {
			    jb.done = true;
			}
		    }
		} catch(err) {
		    u.log("Error in maybeCompleteJob - " + jb + ', ' + err, u.LOG_ERR);
		}
	    } );
	    
	    //	console.log( 'maybeCompleteJob');
	}


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
		if(d.postUpdate) {
		    this.maybeUpdateJob(rm);
		    delete d.postUpdate;
		}

		if( this.maybeCreateJob(rm) ) {
		    this.maybeUpdateJob(rm);
		}
		
		this.maybeCompleteJob(rm);
		try {
		    this.maybeWorkOnTask(rm);
		} catch(err) {
		    u.log("Error in maybeWorkOnTask - " + d.id + ', ' + err, u.LOG_ERR);
		}
	    }	
	}
    };

    memobj.regClasses([Task]);

    function maybeUpdateObject( src, dst, id_name ) {
	let postUpdate = false;
	for(let k of Object.keys(src)) {
	    if(typeof dst[k] === 'undefined' || dst[k] !== src[k]) {
		console.log("Change property of " + id_name + "." +k+"=" +src[k]);
		dst[k] = src[k];
		postUpdate = true;
	    }
	}

	return postUpdate;
    }

    function addOrUpdateTask( room_name, tsk, pts ) {
	let tsk_id = 'unknown';
	try {
	    tsk_id = tsk.id;
	    let ctsk = f.make(tsk, null);
	    if(!ctsk) {
		throw ("Invalid task type");
	    }

	    if(pts) {
		if(! _.isArray(pts) ) {
		    pts = [pts];
		}
	    } else {
		pts = [];
	    }

	    // let hash = Game.rooms[room_name].memory;
	    let hash = Memory.rooms[room_name];
	    if(!hash.tasks) hash.tasks = {};
	    hash = hash.tasks;

	    let o2 = hash[tsk_id];
	    
	    if(!o2) {
		if(!tsk.postDelete) {
		    // create new task
		    hash[tsk_id] = tsk;
		    hash[tsk_id].pts = _.map(pts, memobj.addObject);
		}
	    } else {
		// update
		let postUpdate = maybeUpdateObject( tsk, o2, tsk.id );

		let i_len = _.max( [ o2.pts.length, pts.length ] );
		for( let i=0; i<i_len; ++i )
		{
		    if(!pts[i]) {
			break; // don't delete points 
		    } else if( !o2.pts[i] ) {
			// append point
			console.log("Adding new point " + tsk.id + "[" +i+"]");
			o2.pts.push( memobj.addObject( pts[i] ) );
			postUpdate = true;
		    } else {
			// may be update
			let obj_id = o2.pts[i].obj_id;
			let pt2 = memobj.f.make(o2.pts[i], null);
			
			postUpdate = maybeUpdateObject(pts[i], pt2.d, tsk.id+'['+i + ' ' + obj_id+']' ) || postUpdate;
		    }
		}

		if(postUpdate) {
		    o2.postUpdate = true;
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
