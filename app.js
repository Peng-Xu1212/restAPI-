import express from 'express'
import bodyParser from 'body-parser'
require('dotenv').config()
const pg = require('pg')
const later = require('later')

//set database connect pool
const config = {
	host:process.env.REST_HOST,
	user:process.env.REST_USER,
	password:process.env.REST_PASSWORD,
	server:process.env.REST_SERVER,
	database:process.env.REST_DATABASE,
	port:process.env.REST_DBPORT,
	max:process.env.REST_DBMAX, // max connection
	idleTimeoutMillis:process.env.REST_DBTIME, // max time limit
}
var pool = new pg.Pool(config)
console.log(' Database connection pool loaded:\n {\n Host: '+config.host+'\n User name: '+config.user+'\n Password: '+config.password+'\n Server name: '+config.server+'\n Database name: '+config.database+'\n Postgresql port: '+config.port+'\n Max connecting number: '+config.max+'\n MAx time limit: '+config.idleTimeoutMillis+' seconds\n }\n')

// Parse incoming requests data
const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const PORT = process.env.REST_PORT
const autoTime = process.env.REST_TIMERATE
const maxAccept = process.env.REST_ACCEPTLIM

app.listen(PORT, () => {
	console.log(' API address: http://localhost:'+PORT+'/api/v1')
	console.log(' Auto check timer runs '+autoTime+'.')
	console.log(' Max acception waiting time is '+maxAccept+'.\n')
})

//set timer 
var sched = later.parse.text(autoTime);
var timer = later.setInterval(function() {
	console.log(' Auto check timer',new Date())
	pool.connect().then(db=>{
		//check any task is waiting for acception but time out
		db.query('SELECT task_id, modify_time+$1 AS tl FROM task where state_id=2 AND delete_time IS NULL', [maxAccept]).then(result=>{
			if(result.rows[0]!=null){
				var i=0
				while(result.rows[i]!=null){
					if(result.rows[i].tl<(new Date())){
						db.query('update task set state_id=1,modify_time=CURRENT_TIMESTAMP where task_id=$1 returning task_id', [result.rows[i].task_id]).then(result=>{
							console.log(' Remove assignment of: ',result.rows[i].task_id)
						}).catch(err => {
							console.error(' Unknow error.\n',err)
						})
						db.query('update assignment set delete_time=CURRENT_TIMESTAMP where task_id=$1 AND delete_time IS NULL returning assignment_id', [result.rows[i].task_id]).then(result=>{
							console.log(' Remove assignment : ',result.rows[i].assignment_id)
						}).catch(err => {
							console.error(' Unknow error.\n',err)
						})
					}
					i=i+1
				}
			}
		}).catch(err => {
			console.error(' Unknow error.\n',err)
		})
		
		//check any task is waiting for processing but time out
		db.query('SELECT task_id, modify_time+time_limit AS tl FROM task where state_id=3 AND delete_time IS NULL').then(result=>{
			if(result.rows[0]!=null){
				var i=0
				while(result.rows[i]!=null){
					if(result.rows[i].tl<(new Date())){
						db.query('update task set state_id=1,modify_time=CURRENT_TIMESTAMP where task_id=$1 returning task_id', [result.rows[i].task_id]).then(result=>{
							console.log(' Remove assignment of: ',result.rows[i].task_id)
						}).catch(err => {
							console.error(' Unknow error.\n',err)
						})
						db.query('update assignment set delete_time=CURRENT_TIMESTAMP where task_id=$1 AND delete_time IS NULL returning assignment_id', [result.rows[i].task_id]).then(result=>{
							console.log(' Remove assignment : ',result.rows[i].assignment_id)
						}).catch(err => {
							console.error(' Unknow error.\n',err)
						})
					}
					i=i+1
				}
			}
		}).catch(err => {
			console.error(' Unknow error.\n',err)
		})
		
		db.release()
	}).catch(err => {
		console.error(' Database connection error.\n',err)
	})
	console.log(' Current connected client number:',pool.totalCount-1)
}, sched)

//send response
var undefine
function response(db,res,err,code,message,task_id,assignment_id,file,time_limit,description){
	res.status(code).send({
		message: message,
		task_id: task_id,
		assignment_id: assignment_id,
		file: file,
		time_limit: time_limit,
		description: description
	})
	if(db){
		db.release()
	}
	if(err){
		console.error('Error is: ',err)
	}
	console.log(code,message)
	return 1
}

//deal with pool connection error
function pcE(res,err){
	if(err){
		response(null,res,err,503,'Database connection error.',undefine,undefine,undefine,undefine,undefine)
	}else{
		response(null,res,err,503,'Database connection is full.',undefine,undefine,undefine,undefine,undefine)
	}
	return 1
}

//deal with common error
function cE(db,err,res,field){
	if(err.code=='22P02'){
		response(db,res,err,405,'Wrong type or no '+field+' is provided.',undefine,undefine,undefine,undefine,undefine)
	}else if(err.code=='22007'){
		response(db,res,err,405,'Not interval time_limit is provided.',undefine,undefine,undefine,undefine,undefine)
	}else{
		response(db,res,err,503,'Unknow error.',undefine,undefine,undefine,undefine,undefine)
	}
	return 1
}

//check client permission return 1 if there is permission error
function cpC(result,expect,res,db){
	if(result.rows[0] == null){
		response(db,res,undefine,403,'This client_id is not in record.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}else if(expect == 'internal' && result.rows[0].permission_id == 3){
		response(db,res,undefine,403,'External cannot deal with task.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}else if(expect == 'external' && result.rows[0].permission_id == 2){
		response(db,res,undefine,403,'Internal cannot deal with assignment.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}else if(result.rows[0].delete_time != null){
		response(db,res,undefine,403,'This client has been removed from record.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}
	return 0
}

//check task creation return 1 if error
function tcC(result,client_id,res,db){
	if(result.rows[0] == null){
		response(db,res,undefine,403,'This task is not in the record.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}else if(result.rows[0].client_id != client_id){
		response(db,res,undefine,403,'This client is not the creater of this task.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}else if(result.rows[0].delete_time != null){
		response(db,res,undefine,403,'This task has been removed from record.',undefine,undefine,undefine,undefine,undefine)
		return 1
	}
	return 0
}

//allow internal to create a task
app.post('/api/v1/task', (req, res) => {
	console.log(' New POST /task request arrived.',new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check request body for required fields
			if(req.body.file == ''||req.body.file == null){
				return response(db,res,undefine,405,'Cannot find nonempty file in request body.',undefine,undefine,undefine,undefine,undefine)
			}
			
			db.query('SELECT type_id,time_limit FROM type where type_id=$1',[result.rows[0].type_id]).then(result=>{
				
				//create new task set time_limit if provided
				var time_limit = result.rows[0].time_limit;
				if(req.body.time_limit != null){
					time_limit = req.body.time_limit;
				}
				db.query('insert into task(client_id, file, time_limit, type_id, description) ' + 'values($1, $2, $3, $4, $5) returning task_id, file, time_limit, description'
				, [req.headers.client_id, req.body.file, time_limit, result.rows[0].type_id, req.body.description]).then(result=>{
					return response(db,res,undefine,200,'New task is created.',result.rows[0].task_id,undefine,result.rows[0].file,result.rows[0].time_limit,result.rows[0].description)
				}).catch(err => {
					return cE(db,err,res,'file')
				})
			}).catch(err => {
				return cE(db,err,res,'type_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
})

//allow internal to update a task
app.patch('/api/v1/task/:id', (req, res) => {
	console.log(' New PATCH /task/:id request arrived with task_id:',req.params.id,new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		
		//check client permission
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check whether the same as task creator
			db.query('SELECT * FROM task where task_id=$1',[req.params.id]).then(result=>{
				if(tcC(result,req.headers.client_id,res,db)){
					return 1
				}
				
				//check update task fields
				var file = result .rows[0].file
				var time_limit = result .rows[0].time_limit
				var description = result .rows[0].description
				var noChange = true
				if(req.body.time_limit != null && req.body.time_limit != time_limit){
					time_limit = req.body.time_limit
					noChange = false
				}
				if(req.body.description != null && req.body.description != description){
					description = req.body.description
					noChange = false
				}
				if(req.body.file != null && req.body.file != file){
					file = req.body.file
					noChange = false
				}
				
				if(noChange){
					return response(db,res,undefine,405,'No field is update',undefine,undefine,undefine,undefine,undefine)
				}
				
				//update task
				db.query('update task set file=$1, time_limit=$2, description=$3, modify_time=CURRENT_TIMESTAMP, state_id=1 where task_id=$4 returning task_id'
				,[file, time_limit, description,req.params.id]).then(result=>{
					
					//Cancel assignment af file has been changed.
					db.query('update assignment set delete_time=CURRENT_TIMESTAMP where task_id=$1 AND delete_time IS NULL returning assignment_id', [req.params.id]).catch(err => {
						return cE(db,err,res,'task_id')
					})
					return response(db,res,undefine,200,'Task is updated',result.rows[0].task_id,undefine,result.rows[0].file,result.rows[0].time_limit,result.rows[0].description)
				}).catch(err => {
					return cE(db,err,res,'file')
				})
			}).catch(err => {
				return cE(db,err,res,'task_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});

//allow internal to see the task detail of a task it created
app.get('/api/v1/task/:id', (req, res) => {
	console.log(' New GET /task/:id request arrived with task_id:',req.params.id,new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		
		//check client permission
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check whether the same as task creator
			db.query('SELECT * FROM task where task_id=$1',[req.params.id]).then(result=>{
				if(tcC(result,req.headers.client_id,res,db)){
					return 1
				}
				
				return response(db,res,undefine,200,'Task detail is sent',result.rows[0].task_id,undefine,result.rows[0].file,result.rows[0].time_limit,result.rows[0].description)
			}).catch(err => {
				return cE(db,err,res,'task_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});

//allow internal to delete a task
app.delete('/api/v1/task/:id', (req, res) => {
	console.log(' New DELETE /task/:id request arrived with task_id:',req.params.id,new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		
		//check client permission
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check whether the same as task creator
			db.query('SELECT * FROM task where task_id=$1',[req.params.id]).then(result=>{
				if(tcC(result,req.headers.client_id,res,db)){
					return 1
				}
				
				//remove task
				db.query('update task set modify_time=CURRENT_TIMESTAMP,delete_time=CURRENT_TIMESTAMP, state_id=5 where task_id=$1 returning task_id',[req.params.id]).then(result=>{
					
					//Cancel assignment af file has been changed.
					db.query('update assignment set delete_time=CURRENT_TIMESTAMP where task_id=$1 AND delete_time IS NULL returning assignment_id', [req.params.id]).catch(err => {
						return cE(db,err,res,'task_id')
					})
					return response(db,res,undefine,200,'Task is deleted',result.rows[0].task_id,undefine,undefine,undefine,undefine)
				}).catch(err => {
					return cE(db,err,res,'file')
				})
			}).catch(err => {
				return cE(db,err,res,'task_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});

//allow external to get a assignment
app.get('/api/v1/allocator', (req, res) => {
	var type_id
	console.log(' New GET /allocator request arrived',new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		
		//check client permission
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'external',res,db)){
				return 1
			}
			type_id = result.rows[0].type_id
			
			//check whether the same as task creator
			db.query('SELECT * FROM task where task_id=$1',[req.params.id]).then(result=>{
				if(tcC(result,req.headers.client_id,res,db)){
					return 1
				}
				
				//check assignment table, if already assigned a task, resend the data
				db.query('SELECT * FROM assignment where client_id=$1 AND delete_time IS NULL',[req.headers.client_id]).then(result=>{
					if(result.rows[0]!=null){
						var assignment_id = result.rows[0].assignment_id
						db.query('SELECT file FROM task where task_id=$1 AND delete_time IS NULL AND state_id BETWEEN 1 AND 3', [req.params.id]).then(result=>{
							return response(db,res,undefine,200,'Resend the file',undefine,assignment_id,result.rows[0].file,result.rows[0].time_limit,result.rows[0].description)
						}).catch(err => {
							return cE(db,err,res,'task_id')
						})
					}else{
						//search for unassigned task
						db.query('update task set state_id=2, modify_time=CURRENT_TIMESTAMP where delete_time IS NULL AND state_id=1 AND type_id=$1 returning task_id,file,time_limit,description'
						, [type_id]).then(result=>{
							if(result.rows[0] == null){
								return response(db,res,undefine,405, 'No task is waiting.',undefine,undefine,undefine,undefine,undefine)
							}else{
								var file = result.rows[0].file;
								var time_limit = result.rows[0].time_limit;
								var description = result.rows[0].description;
								db.query('insert into assignment(task_id, client_id) ' + 'values($1, $2) returning assignment_id', [result.rows[0].task_id, req.headers.client_id]).then(result=>{
									return response(db,res,undefine,200,'Task preassigned.',undefine,result.rows[0].assignment_id,file,time_limit,description)
								}).catch(err => {
									return cE(db,err,res,'client_id')
								})
							}
						}).catch(err => {
							return cE(db,err,res,'type_id')
						})
					}
				}).catch(err => {
					return cE(db,err,res,'client_id')
				})
			}).catch(err => {
				return cE(db,err,res,'task_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});

//allow external to accept a assignment
app.post('/api/v1/allocator', (req, res) => {
	console.log(' New POST /allocator request arrived.',new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check request body for required fields
			if(req.body.acception != 'true' && req.body.acception != 'false' && req.body.acception != true && req.body.acception != false){
				return response(db,res,undefine,405,'Cannot find acception in request body. ',undefine,undefine,undefine,undefine,undefine)
			}
			
			db.query('SELECT * FROM assignment where client_id=$1',[req.headers.client_id]).then(result=>{
				var assignment_id = result.rows[0].assignment_id
				if(result.rows[0] == null){
					return response(db,res,undefine,403,'No task is assigned to this client.',undefine,undefine,undefine,undefine,undefine)
				}else{
					db.query('SELECT * FROM task where task_id=$1',[result.rows[0].task_id]).then(result=>{
						if(result.rows[0].state_id != 2){
							return response(db,res,err,403,'Your assignment has already been accepted by you.',undefine,assignment_id,undefine,undefine,undefine)
						}else{
							if(req.body.acception != 'true' || req.body.acception != true){
								db.query('update task set state_id=3, modify_time=CURRENT_TIMESTAMP where task_id=$1 returning task_id',[result.rows[0].task_id]).then(result=>{
									return response(db,res,undefine,200,'Assignment accepteded.',undefine,assignment_id,undefine,undefine,undefine)
								}).catch(err => {
									return cE(db,err,res,'task_id')
								})
							}else{
								db.query('update task set state_id=1, modify_time=CURRENT_TIMESTAMP where task_id=$1 returning task_id',[result.rows[0].task_id]).catch(err => {
									return cE(db,err,res,'task_id')
								})
								db.query('update assignment set delete_time=CURRENT_TIMESTAMP where assignment_id=$1 returning assignment_id',[assignment_id]).then(result=>{
									return response(db,res,undefine,200,'Assignment refused.',undefine,assignment_id,undefine,undefine,undefine)
								}).catch(err => {
									return cE(db,err,res,'task_id')
								})
							}
						}
					}).catch(err => {
						return cE(db,err,res,'task_id')
					})
				}
			}).catch(err => {
				return cE(db,err,res,'client_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});

//allow external to submit a assignment
app.post('/api/v1/submission', (req, res) => {
	console.log(' New POST /submission request arrived.',new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check request body for required fields
			if(req.body.file == ''||req.body.file == null){
				return response(db,res,undefine,405,'Cannot find nonempty file in request body. ',undefine,undefine,undefine,undefine,undefine)
			}
			
			if(req.body.commission != null && req.body.commission != 'true' && req.body.commission != 'false' && req.body.commission != true && req.body.commission != false){
				return response(db,res,undefine,405,'Wrong value type of commission is found.',undefine,undefine,undefine,undefine,undefine)
			}
			
			db.query('SELECT * FROM assignment where client_id=$1 AND delete_time IS NULL',[req.headers.client_id]).then(result=>{
				if(result.rows[0] == null){
					return response(db,res,undefine,403,'No assignment need to be submited.',undefine,undefine,undefine,undefine,undefine)
				}else if(req.body.commission == 'true' || req.body.commission == true){
					db.query('update task set state_id=4,modify_time=CURRENT_TIMESTAMP where task_id=$1 AND state_id=3 returning task_id',[result.rows[0].task_id]).then(result=>{
						if(result.rows[0] == null){
							return response(db,res,undefine,405,'This assignment is not waiting for submission.',undefine,undefine,undefine,undefine,undefine)
						}else{
							db.query('insert into response(client_id, task_id, file, description) ' + 'values($1, $2, $3, $4) returning client_id, task_id', [req.headers.client_id, result.rows[0].task_id, req.body.file, req.body.description]).then(result=>{
								db.query('update assignment set delete_time=CURRENT_TIMESTAMP where task_id=$1 AND client_id=$2 AND delete_time IS NULL', [result.rows[0].task_id,result.rows[0].client_id]).then(result=>{
									return response(db,res,undefine,200,'Result submited and assignment is committed.',undefine,undefine,undefine,undefine,undefine)
								}).catch(err => {
									return cE(db,err,res,'client_id')
								})
							}).catch(err => {
								return cE(db,err,res,'file')
							})
						}
					}).catch(err => {
						return cE(db,err,res,'task_id')
					})
				}else{
					db.query('update task set state_id=4,modify_time=CURRENT_TIMESTAMP where task_id=$1 AND state_id BETWEEN 2 AND 4 returning task_id',[result.rows[0].task_id]).then(result=>{
						if(result.rows[0] == null){
							return response(db,res,undefine,405,'This assignment is not waiting for submission.',undefine,undefine,undefine,undefine,undefine)
						}else{
							db.query('insert into response(client_id, task_id, file, description) ' + 'values($1, $2, $3, $4) returning client_id, task_id', [req.headers.client_id, result.rows[0].task_id, req.body.file, req.body.description]).then(result=>{
								return response(db,res,undefine,200,'Result submited and assignment is not committed.',undefine,undefine,undefine,undefine,undefine)
							}).catch(err => {
								return cE(db,err,res,'file')
							})
						}
					}).catch(err => {
						return cE(db,err,res,'task_id')
					})
				}
			}).catch(err => {
				return cE(db,err,res,'assignment_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
})

//allow internal to get a result of a task
app.get('/api/v1/submission/:id', (req, res) => {
	console.log(' New GET /submission request arrived for task:',req.params.id,new Date(),'\n Header: ',req.headers,'\n Body: ',req.body,'\n')
	
	//check whether the database connection pool is full
	if(pool.totalCount==process.env.REST_DBMAX-1){
		return pcE(res,null)
	}
	
	pool.connect().then(db=>{
		
		//check client permission
		db.query('SELECT * FROM client where client_id=$1',[req.headers.client_id]).then(result=>{
			if(cpC(result,'internal',res,db)){
				return 1
			}
			
			//check whether the same as task creator
			db.query('SELECT * FROM task where task_id=$1',[req.params.id]).then(result=>{
				if(tcC(result,req.headers.client_id,res,db)){
					return 1
				}
				
				if(result.rows[0].state_id < 4){
					return response(db,res,undefine,403,'Task is still in processing',undefine,undefine,undefine,undefine,undefine)
				}
				
				//get latest result
				db.query('SELECT task_id,file FROM response where task_id=$1 AND delete_time IS NULL ORDER BY create_time DESC',[req.params.id]).then(result=>{
					return response(db,res,undefine,200,'Task result is sent',result.rows[0].task_id,undefine,result.rows[0].file,undefine,result.rows[0].description)
				}).catch(err => {
					return cE(db,err,res,'file')
				})
			}).catch(err => {
				return cE(db,err,res,'task_id')
			})
		}).catch(err => {
			return cE(db,err,res,'client_id')
		})
	}).catch(err => {
		return pcE(res,err)
	})
});