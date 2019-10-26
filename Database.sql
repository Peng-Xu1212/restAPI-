-- Database: which included ten specific tables(permission, state, type, client, task, assignment, response, error and log)
DROP DATABASE IF EXISTS restfuldb;
CREATE DATABASE restfuldb;

\c restfuldb;


-- The logtype table is logtype the task
/*CREATE TABLE logtype
(
    logtype_id integer PRIMARY KEY,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL
);


/* Description should be logtype type plus endpoints */
INSERT INTO logtype (logtype_id, description)
  VALUES (1,'post /task');
INSERT INTO logtype (logtype_id, description)
  VALUES (2,'patch /task/:id');
INSERT INTO logtype (logtype_id, description)
  VALUES (3,'delete /task/:id');
INSERT INTO logtype (logtype_id, description)
  VALUES (4,'get /allocator');
INSERT INTO logtype (logtype_id, description)
  VALUES (5,'patch /allocator/:id');
INSERT INTO logtype (logtype_id, description)
  VALUES (6,'post /submission/:id');
INSERT INTO logtype (logtype_id, description)
  VALUES (7,'get /submission/:id');
INSERT INTO logtype (logtype_id, description)
  VALUES (8,'remove assignment because time out');
SELECT * FROM logtype;


-- Here is permission table for distinguish the access permission
CREATE TABLE permission
(
    permission_id integer PRIMARY KEY,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL
);

/*The first world represents the client type(e.g internal and external), and 
the rest of number means request types it can send. */
INSERT INTO permission (permission_id, description)
 VALUES (1, 'Admin 1,2,3,4,5,6,7');
INSERT INTO permission (permission_id, description)
 VALUES (2, 'Internal 1,2,3,7');
INSERT INTO permission (permission_id, description)
 VALUES (3, 'External 4,5,6');
SELECT * FROM permission;


-- Here is response to current status 
CREATE TABLE state
(
    state_id integer PRIMARY KEY,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL
);

INSERT INTO state (state_id, description)
  VALUES (1,'waiting for assignment');
INSERT INTO state (state_id, description)
  VALUES (2,'waiting for accepted');
INSERT INTO state (state_id, description)
  VALUES (3,'waiting for processing');
INSERT INTO state (state_id, description)
  VALUES (4,'finished');
INSERT INTO state (state_id, description)
  VALUES (5,'deleted');
SELECT * FROM state;


-- reading serval kinds of file(texture )
CREATE TABLE type
(
    type_id integer PRIMARY KEY,
    time_limit interval,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL
);

/* The description is represents the different kind of type */
INSERT INTO type (type_id, time_limit, description)
  VALUES (1, '30 minutes', 'texture');
INSERT INTO type (type_id, time_limit, description)
  VALUES (2, '50 minutes','picture');
INSERT INTO type (type_id, time_limit, description)
  VALUES (3, '90 minutes', 'voice');
SELECT * FROM type;


-- Which is for record the current client
CREATE TABLE client
(
    client_id serial PRIMARY KEY,
    permission_id integer NOT NULL,
    type_id integer NOT NULL,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL,
    FOREIGN KEY (permission_id)
        REFERENCES permission (permission_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (type_id)
        REFERENCES type (type_id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/* The description should respresents the access user and type of file */
INSERT INTO client (permission_id, type_id,description)
  VALUES (1, 1,'admin/texture');
INSERT INTO client (permission_id, type_id,description)
  VALUES (1, 2,'admin/picture');
INSERT INTO client (permission_id, type_id,description)
  VALUES (2, 1,'internal/texture');
INSERT INTO client (permission_id, type_id,description)
  VALUES (2, 2,'internal/picture');
INSERT INTO client (permission_id, type_id,description)
  VALUES (3, 1,'external/texture');
INSERT INTO client (permission_id, type_id,description)
  VALUES (3, 2,'external/picture');
SELECT * FROM client;


-- Here is for handle the task 
CREATE TABLE task
(
    task_id serial PRIMARY KEY,
    client_id integer NOT NULL,
    state_id integer NOT NULL,
    type_id integer DEFAULT 1,
    file XML NOT NULL,
    time_limit interval,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    modify_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL,
    FOREIGN KEY (client_id)
        REFERENCES client (client_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (state_id)
        REFERENCES state (state_id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


-- the assignment should be handled in here
CREATE TABLE assignment
(
    assignment_id serial PRIMARY KEY,
    task_id integer NOT NULL,
    client_id integer NOT NULL,
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL,
    FOREIGN KEY (client_id)
        REFERENCES client (client_id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (task_id)
        REFERENCES task (task_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


-- the response should be handled in here, which get used client and task id
CREATE TABLE response
(
    response_id serial PRIMARY KEY,
    client_id integer NOT NULL,
    task_id integer NOT NULL,
    file XML NOT NULL,
    description character varying(255) DEFAULT 'new thing created',
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    delete_time timestamp DEFAULT NULL,
    FOREIGN KEY (client_id)
        REFERENCES client (client_id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (task_id)
        REFERENCES task (task_id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


-- No need to use now
-- this table is used for storing all the request
/*
CREATE TABLE log
(
    log_id SERIAL PRIMARY KEY,
    logtype_id integer,
    task_id integer,
    client_id integer,
    assignment_id integer,
    response_id integer,
    statu character varying(225),
    message character varying(225),
    req_head XML,
    req_body XML,
    success boolean,
    create_time timestamp DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (logtype_id)
        REFERENCES logtype (logtype_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (task_id)
        REFERENCES task (task_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (client_id)
        REFERENCES client (client_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (assignment_id)
        REFERENCES assignment (assignment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (response_id)
        REFERENCES response (response_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

*/