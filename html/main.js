window.Game = {};
var keyDown = {};
keyDown.clicked = 0; //USED LATER TO ALLOW DOUBLE JUMPS
var users = {}; //USED TO TRACK CURRENT PLAYERS ON SERVER

//THIS FUNCTION HANDLES DRAWING BOUNDARIES FOR RECTANGLES USED IN OUR GAME
//RECTANGLES SUCH AS OUR MAP, VIEWPORT, HITBOX AROUND THE PLAYER, AND FLOORS
(function() {
    //FUNCTION HANDLES CREATING THE RECTANGLE PARAMETERS
    function Rect(left, top, width, height) {
      this.left = left || 0;
      this.top = top || 0;
      this.width = width || 0;
      this.height = height || 0;
      this.right = this.left + this.width;
      this.bottom = this.top + this.height;
    }

    //FUNCTION HANDLES UPDATING VALUES OF THE RECTANGLE
    Rect.prototype.set = function(left, top) {
      this.left = left;
      this.top = top;
      this.right = (this.left+this.width);
      this.bottom = (this.top + this.height);
    };

    //FUNCTION HANDLES CHECKING IF THE VIEWPORT IS WITHIN THE MAP
    Rect.prototype.within = function(r) {
      return(r.left <= this.left &&
             r.right >= this.right &&
             r.top <= this.top &&
             r.bottom >= this.bottom);
    }

    //FUNCTION HANDLES CHECKING IF RECTANGLES ARE OVERLAPPING
    Rect.prototype.overlaps = function(r) {
      return(!(this.top >= r.bottom ||
             this.bottom <= r.top ||
             this.left >= r.right ||
             this.right <= r.left));
    }

    Game.Rect = Rect; //ADDING THE RECTANGLE 'CLASS' TO OUR GAME OBJECT
})();

//THIS 'CLASS' HANDLES 'DRAWING' A VIEWPORT THAT FOLLOWS THE PLAYER
//THE VIEWPORT ITSELF IS 'DRAWING' OF A SPLICED IMAGE FROM THE LARGER MAP
(function() {
    var AXIS = {NONE: "none", BOTH: "both"}; //DIRECTIONS WHICH THE VIEWPORT CAN MOVE

    function Camera(xView, yView, canvasWidth, canvasHeight, worldWidth, worldHeight) {
      this.xView = xView || 0;                                                        //X COORD TO DRAW REFERENCING MAP
      this.yView = yView || 0;                                                        //Y COORD TO DRAW REFERENCING MAP
      this.xDeadZone = 0;                                                             //HORIZONTAL DEADZONE TO STOP CAMERA MOVEMENT
      this.yDeadZone = 0;                                                             //VERTICAL DEADZONE TO STOP CAMERA MOVEMENT
      this.wView = canvasWidth;                                                       //WIDTH OF OUR VIEWPORT
      this.hView = canvasHeight;                                                      //HEIGHT OF OUR VIEWPORT
      this.axis = AXIS.BOTH;                                                          //HANDLES DIRECTION OF MOVEMENT
      this.followed = null;                                                           //PLAYER TO FOLLOW
      this.viewPort = new Game.Rect(this.xView, this.yView, this.wView, this.hView);  //CREATING THE RECTANGLE FOR OUR VIEWPORT
      this.world = new Game.Rect(0, 0, worldWidth, worldHeight);                      //CREATING RECTANGLE OF MAP FOR REFERENCE
    }

    //FUNCTION THAT HANDLES FOLLOWING OUR PLAYER
    Camera.prototype.follow = function(gameObject, xDeadZone, yDeadZone) {
      this.followed = gameObject;  //PLAYER
      this.xDeadZone = xDeadZone;  //LEFTMOST AND RIGHTMOST LIMITS OF THE CAMERA
      this.yDeadZone = yDeadZone;  //TOPMOST AND BOTTOMMOST LIMITS OF THE CAMERA
    }

    //FUNCTION THAT HANDLES UPDATING THE CURRENT CAMERA
    Camera.prototype.update = function() {
      if(this.followed != null) {
        if(this.axis == AXIS.BOTH) { //HANDLES 'DRAWING' OUR CAMERA LEFT AND RIGHT
					if(this.followed.x - this.xView  + this.xDeadZone > this.wView)
						this.xView = this.followed.x - (this.wView - this.xDeadZone);
					else if(this.followed.x  - this.xDeadZone < this.xView)
						this.xView = this.followed.x  - this.xDeadZone;

				}
				if(this.axis == AXIS.BOTH){ //HANDLES 'DRAWING' OUR CAMERA UP AND DOWN
					if(this.followed.y - this.yView + this.yDeadZone > this.hView)
						this.yView = this.followed.y - (this.hView - this.yDeadZone);
					else if(this.followed.y - this.yDeadZone < this.yView)
						this.yView = this.followed.y - this.yDeadZone;
				}
      }

      this.viewPort.set(this.xView, this.yView); //UPDATING THE CURRENT COORDINATES TO 'DRAW' FROM THE MAP

      if(!this.viewPort.within(this.world)) {//HANDLES BOUNDARIES OF CAMERA MOVING WITHIN MAP
        if(this.viewPort.left < this.world.left)
          this.xView = this.world.left;
        if(this.viewPort.top < this.world.top)
          this.yView = this.world.top;
        if(this.viewPort.right > this.world.right)
          this.xView = this.world.right - this.wView;
        if(this.viewPort.bottom > this.world.bottom)
          this.yView = this.world.bottom - this.hView;
      }
    }

    Game.Camera = Camera; //ADDING THE CAMERA 'CLASS' TO OUR GAME OBJECT
})();

//'CLASS' HANDLES THE MAIN PLAYER
(function() {
    function Player(name, floors, x, y) {
      this.x = x;                 //CURRENT X OF THE PLAYER
      this.y = y;                 //CURRENT Y OF THE PLAYER
      this.width = 184;           //WIDTH OF SPRITESHEET
      this.height = 192;          //HEIGHT OF SPRITESHEET
      this.spriteWidth = 23;      //WIDTH OF OUR PLAYER
      this.spriteHeight = 32;     //HEIGHT OF OUR PLAYER
      this.frames = 8;            //NUMBER OF HORIZONTAL SPRITES
      this.ticks = 20;            //HANDLES SPEED OF CHANGING HORIZONTAL SPRITES ====> TOTAL TICKS TO COUNT
      this.tickCount = 0;         //HANDLES SPEED OF CHANGING HORIZONTAL SPRITES
      this.xFrame = 0;            //CURRENT HORIZONTAL INDEX OF SPRITESHEET
      this.yFrame = 0;            //CURRENT VERTICAL INDEX OF SPRITESHEET
      this.xVel = 0;              //CURRENT PLAYER VELOCITY IN THE X COORDINATE
      this.yVel = 0;              //CURRENT PLAYER VELOCITY IN THE Y COORDINATE
      this.isJumping = false;     //CHECKING IF THE PLAYER IS CURRENTLY JUMPING OR IN THE AIR
      this.isRunning = false;     //CHECKING IF THE PLAYER IS CURRENTLY RUNNING
      this.doubleJump = false;    //CHECKING IF THE PLAYER IS ALLOWED TO DOUBLEJUMP
      this.direction = "right";   //CURRENT DIRECTION OF THE PLAYER
      this.gravity = 0.5;         //GRAVITY FOR PLAYER FALLING
      this.friction = 0.95;       //FRICTION USED FOR ACCELERATING AND DECELERATING THE PLAYER
      this.hitBox = new Game.Rect(this.x, this.y, this.spriteWidth, this.spriteHeight); //DRAWS A HITBOX AROUND THE PLAYER TO CHECK IF THEY ARE STANDING ON GROUND
      this.floorArray = floors;   //A LIST OF ALL CURRENT FLOORS
      this.currentFloor = null;   //KEEPS TRACK OF THE CURRENT FLOOR THE PLAYER IS STANDING ON
      this.name = name;           //NAME THE USER GIVES THE PLAYER

      this.image = new Image();   //LOADING SPRITESHEET FOR THE PLAYER
      this.image.src = "Sprites/playerSheet.png";
    }

    //FUNCTION HANDLES WHAT VERTICAL SPRITES TO DRAW FROM THE SPRITESHEET IN ACCORDANCE TO PLAYER'S DIRECTION AND MOVEMENT
    Player.prototype.changeSpriteDirection = function() {
      if(!this.isRunning && this.direction == 'right' && !this.isJumping) this.yFrame = 0;
      else if(!this.isRunning && this.direction == 'left' && !this.isJumping) this.yFrame = 1;
      else if(this.isRunning && this.direction == 'right' && !this.isJumping) this.yFrame = 2;
      else if(this.isRunning && this.direction == 'left' && !this.isJumping) this.yFrame = 3;
      else if(!this.isRunning && this.direction == 'right' && this.isJumping) this.yFrame = 4;
      else if(!this.isRunning && this.direction == 'left' && this.isJumping) this.yFrame = 5;
    }

    //FUNCTION HANDLES JUMPING AND DOUBLEJUMPING
    Player.prototype.checkJump = function() {
      if(keyDown.clicked < 2 && !this.isJumping) { //HANDLES FIRST JUMP
        if(32 in keyDown) { //JUMPING
          this.currentFloor = null;
          this.isJumping = true;
          this.isRunning = false;
          this.yVel = -10.0;
          this.y += this.yVel;
          this.y = parseInt(this.y); //ROUNDED TO AN INTEGER SO THE SPRITE DOESN'T BLUR
          this.doubleJump = true;
        }
      }else if(keyDown.clicked == 1 && this.isJumping && this.doubleJump) { //HANDLES DOUBLE JUMP
        if(32 in keyDown) { //JUMPING
          this.currentFloor = null;
          this.isJumping = true;
          this.isRunning = false;
          this.yFrame = 4;
          this.yVel = -12.0;
          this.y += this.yVel;
          this.y = parseInt(this.y); //ROUNDED TO AN INTEGER SO THE SPRITE DOESN'T BLUR
          this.doubleJump = false;
        }
      }
    }

    //FUNCTION HANDLES CHECKING WHETHER THE PLAYER IS STANDING ON A FLOOR AND KEEPS TRACK OF THE CURRENT FLOOR
    Player.prototype.collision = function() {
      this.hitBox.set(this.x, this.y);

      for(current in this.floorArray) {
        if(this.hitBox.overlaps(this.floorArray[current])) {
          this.currentFloor = this.floorArray[current];
        }
      }
    }

  //SOCKET FUNCTION TO SEND MESSAGE TO THE SERVER ABOUT THE CURRENT PLAYERS WHEREABOUTS
	Player.prototype.sendMessage = function() {
		var playerX = parseInt(this.x);
		var playerY = parseInt(this.y);
		var message = {playerName: this.name, x : playerX, y : playerY, xVel : this.xVel, yVel : this.yVel};
		ws.send(JSON.stringify(message));
	}

    //UPDATE FUNCTION FOR OUR PLAYER CHARACTER
    Player.prototype.update = function(step, worldWidth, worldHeight) {
      this.hitBox.set(this.x, this.y);
      if(37 in keyDown && !(32 in keyDown)) { //MOVING LEFT
        this.direction = "left";
        if(!this.isJumping) {
          this.isRunning = true;
          this.isJumping = false;
        }
        if(Math.round(this.x) > 10) {
          this.xVel--;
        }
      }else if(37 in keyDown && 32 in keyDown) {//JUMPING AND MOVING LEFT
        this.checkJump();
        if(Math.round(this.x) > 10) {
          this.xVel--;
        }
      }

      if(39 in keyDown && !(32 in keyDown)) {//MOVING RIGHT
        this.direction = "right";
        if(!this.isJumping) {
          this.isRunning = true;
          this.isJumping = false;
        }
        if(Math.round(this.x) < worldWidth) {
          this.xVel++;
        }
      }else if(39 in keyDown && 32 in keyDown) {//JUMPING AND MOVING RIGHT
        this.checkJump();
        if(Math.round(this.x) < worldWidth) {
          this.xVel++;
        }
      }

      if(32 in keyDown && !(37 in keyDown) && !(39 in keyDown)) {//STATIONARY JUMP
        this.checkJump();
      }

      this.collision();

      //IF BLOCK THAT HANDLES STANDING ON PLATFORMS. COULD BE REWORKED AND FINE TUNED FOR NOW IT ONLY HANDLES STANDING
      if(this.currentFloor == null) {
        this.isJumping = true;
        this.yVel += this.gravity;
        this.y += this.yVel;
        this.y = parseInt(this.y);
      }else {
        if(this.hitBox.top >= this.currentFloor.top && this.hitBox.bottom >= this.currentFloor.top && this.hitBox.right < this.currentFloor.right && this.hitBox.left > this.currentFloor.left && this.yVel >= 0) {//MAKESHIFT GROUND
          this.yVel = 0;
          this.y = this.currentFloor.top;
          keyDown.clicked = 0;
          this.isJumping = false;
          this.doubleJump = false;
        }else {
          this.isJumping = true;
          this.yVel += this.gravity;
          this.y += this.yVel;
          this.y = parseInt(this.y);
        }
      }

      this.xVel *= this.friction;   //SETS THE SPEED FOR THE PLAYER
      this.x += this.xVel;          //MOVES THE PLAYER IN THE X DIRECTION BASED ON SPEED
      this.x = parseInt(this.x);    //MAKE INTEGER COORDINATE TO STOP BLUR

      if(this.xVel < 0 && this.xVel >-0.5 || this.xVel > 0 && this.xVel < 0.5) {//STOP PLAYER MOVEMENT WHEN REACHING A LIMIT
        this.isRunning = false;
        this.xVel = 0;
      }

      this.changeSpriteDirection(); //HANDLES CHANGING THE CURRENT SPRITE Y INDEX BASED ON MOVEMENT

      if(this.x - this.spriteWidth/2 < 0){//LEFT BORDER
				this.x = this.spriteWidth/2;
			}
			if(this.y - this.spriteHeight/2 < 0){//TOP BORDER
				this.y = this.spriteHeight/2;
			}
			if(this.x + this.spriteWidth/2 > worldWidth){//RIGHT BORDER
				this.x = worldWidth - this.spriteWidth/2;
			}
			if(this.y + this.spriteWidth/2 > worldHeight){//BOTTOM BORDER
				this.y = worldHeight - this.spriteWidth/2;
			}

      this.tickCount += 1;
      if(this.tickCount >= this.ticks) {  //HANDLES DRAWING HORIZONTAL SPRITES FROM SPRITESHEET
        this.tickCount = 0;
        if(this.xFrame < this.frames - 1) {
          this.xFrame += 1;
        }else {
          this.xFrame = 0;
        }
      }
    }

    //FUNCTION HANDLES DRAWING THE PLAYER TO THE 2D CANVAS
    Player.prototype.draw = function(context, xView, yView){
      context.drawImage(this.image,
                        this.xFrame * (this.width/this.frames),
                        this.yFrame * this.height/6,
                        this.width/this.frames,
                        this.height/6,
                        parseInt((this.x-this.spriteWidth/2) - xView),
                        parseInt((this.y-this.spriteHeight/2) - yView),
                        this.width/this.frames,
                        this.height/6);
		}


    Game.Player = Player; //ADDING OUR PLAYER 'CLASS' TO THE GAME OBJECT
})();

//'CLASS' HANDLES THE OTHER USERS ON THE SERVER
(function() {
	 function EnemyPlayer(name, x, y, xVelocity, yVelocity){
	  this.x = x;
		this.y = y;
		this.width = 184;
		this.height = 192;
		this.spriteWidth = 23;
		this.spriteHeight = 32;
		this.frames = 8;
		this.ticks = 20;
		this.tickCount = 0;
		this.xFrame = 0;
		this.yFrame = 0;
    this.playerName = name;
    this.xVel = xVelocity;
    this.yVel = yVelocity;
    this.direction = 'right';

		this.image = new Image();
		this.image.src = "Sprites/enemySheet.png";
	}

  //FUNCTION HANDLES WHICH SPRITES TO DRAW FOR THE ENEMIES
  EnemyPlayer.prototype.changeSpriteDirection = function() {
    if(this.xVel > 0 && this.yVel == 0) {
      this.yFrame = 2;
      this.direction = 'right';
    }else if(this.xVel < 0 && this.yVel == 0) {
      this.yFrame = 3;
      this.direction = 'left';
    }else if(this.yVel > 0 && this.direction == 'right' || this.yVel < 0 && this.direction == 'right') {
      this.yFrame = 4
      this.direction = 'right';
    }else if(this.yVel > 0 && this.direction == 'left' || this.yVel < 0 && this.direction == 'left') {
      this.yFrame = 5;
      this.direction = 'left';
    }else if(this.xVel == 0 && this.yVel == 0 && this.direction == 'right') {
      this.yFrame = 0;
    }else if(this.xVel == 0 && this.yVel == 0 && this.direction == 'left') {
      this.yFrame = 1;
    }
  }

  //FUNCTION HANDLES UPDATING THE ANIMATION FOR THE OTHER USERS
	EnemyPlayer.prototype.update = function(){
    this.changeSpriteDirection();

		this.tickCount += 1;
		if(this.tickCount >= this.ticks) {  //HANDLES DRAWING HORIZONTAL SPRITES FROM SPRITESHEET
			this.tickCount = 0;
			if(this.xFrame < this.frames - 1) {
				this.xFrame += 1;
			}else {
				this.xFrame = 0;
			}
		}
	}

  //FUNCTION HANDLES DRAWING THE OTHER PLAYERS ON THE SERVER
	EnemyPlayer.prototype.draw = function(title, context, xWorld, yWorld){
    if(title) {
      context.drawImage(this.image,
                        this.xFrame * this.width/this.frames,
                        this.yFrame * this.height/6,
                        this.width/this.frames,
                        this.height/6,
                        parseInt(this.x * 0.41739),
                        parseInt((this.y-(this.spriteHeight/2)) * 0.76),
                        this.width/this.frames,
                        this.height/6);
    }else{
      context.drawImage(this.image,
                        this.xFrame * (this.width/this.frames),
                        this.yFrame * this.height/6,
                        this.width/this.frames,
                        this.height/6,
                        parseInt((this.x-this.spriteWidth/2) - xWorld),
                        parseInt((this.y-this.spriteHeight/2) - yWorld),
                        this.width/this.frames,
                        this.height/6);
        }
	}

	Game.EnemyPlayer = EnemyPlayer;

})();

//FUNCTION THAT HANDLES DRAWING THE MAP FROM WHICH THE CAMERA REFERENCES
(function() {
    function Map(title, width, height) {
      this.width = width;
      this.height = height;
      this.image = new Image();
      this.image.src = "twinPeaks.png";
      this.title = title;
    }

    Map.prototype.draw = function(context, xView, yView) {
      if(this.title) {
        context.drawImage(this.image,
                          0,
                          0,
                          this.image.width,
                          this.image.height,
                          0,
                          0,
                          context.canvas.width,
                          context.canvas.height);

      }else {
        var sX, sY, dX, dY;
        var sWidth, sHeight, dWidth, dHeight;

        sX = xView; //X COORD FOR CAMERA TO SPLICE FROM MAP
        sY = yView; //Y COORD FOR CAMERA TO SPLICE FROM MAP

        sWidth = context.canvas.width;    //WIDTH OF OUR VIEWPORT
        sHeight = context.canvas.height;  //HEIGHT OF OUR VIEWPORT

        if(this.image.width - sX < sWidth) {
          sWidth = this.image.width - sX;
        }
        if(this.image.height -sY < sHeight) {
          sHeight = this.image.height - sY;
        }

        dX = 0; //X COORD TO DRAW VIEWPORT ON CANVAS
        dY = 0; //Y COORD TO DRAW VIEWPORT ON CANVAS

        dWidth = sWidth;    //SPLICED WIDTH IS THE SAME WIDTH OF OUR VIEWPORT
        dHeight = sHeight;  //SPLICED HEIGHT IS THE SAME HEIGHT OF OUR VIEWPORT


        context.drawImage(this.image, sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight);
      }

    }


    Game.Map = Map; //ADDING OUR MAP 'CLASS' TO THE GAME OBJECT
})();

//FUNCTION THAT HANDLES OUR GAME ENGINE
(function() {
    var canvas = document.getElementById("canvas1");
    var context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var titleScreen = true;
    var player;
    var camera;
    var enemies = [];

    var FPS = 60;
    var INTERVAL = 1000/FPS;
    var STEP = INTERVAL/1000; //FOR SMOOTH MOVEMENT

    var room = {  //OBJECT FOR OUR MAP
      width: 4600,
      height: 1234,
      map: new Game.Map(titleScreen, 4600, 1234)
    }

    var floors = { //CREATES ARRAY OF FLOORS FOR USER TO RUN AROUND ON
      floorOne: new Game.Rect(11, 959, 798, 75),
      floorTwo: new Game.Rect(1534, 959, 1564, 75),
      floorThree: new Game.Rect(3830, 959, 798, 75),
      floorFour: new Game.Rect(384, 766, 1564, 75),
      floorFive: new Game.Rect(2684, 766, 1564, 75),
      floorSix: new Game.Rect(11, 569, 798, 75),
      floorSeven: new Game.Rect(1534, 569, 1564, 75),
      floorEight: new Game.Rect(3830, 569, 798, 75),
      mainFloor: new Game.Rect(0, 1154, 4632, 75)
    }

    var input = document.createElement("input"); //CREATES THE INPUT FOR USER TO TYPE NAME IN
    input.type = 'text';
    input.id = 'input';
    input.style.position = 'fixed';
    input.align = 'right';
    input.style.left = canvas.width/2 - 80;
    input.style.top = canvas.height/2 + 50;

    document.body.appendChild(input);

    var button = document.createElement("button"); //CREATES BUTTON FOR USER TO SUBMIT NAME AND START PLAYING
    var text = document.createTextNode("Enter Name");
    button.appendChild(text);
    button.style.position = 'fixed';
    button.style.left = canvas.width/2 - 40;
    button.style.top = canvas.height/2 + 100;

    document.body.appendChild(button);


    //FUNCTION HANDLES UPDATING NEW VALUES FOR OUR PLAYER AND VIEWPORT AS WELL AS ENEMIES
    var update = function() {
      if(!titleScreen) {
        player.update(STEP, room.width, room.height);
        camera.update();
      }

      for(current in enemies) {
        enemies[current].update();
      }
    }

    //FUNCTION HANDLES CHECKING IF THE CURRENT ENEMY IS ALREADY IN THE LIST OF ENEMIES
    var contains = function(player, list) {
      for(current in list) {
        if(list[current].playerName == player.playerName) {
          list[current].x = player.x;
          list[current].y = player.y;
          list[current].yVel = player.yVel;
          list[current].xVel = player.xVel;
          return true;
        }
      }

      return false;
    }


    //FUNCTION HANDLES POPULATING THE ENEMY LIST
    var populateEnemies = function() {
      for(current in users) {
        var enemyPlayer = new Game.EnemyPlayer(users[current].playerName, users[current].x, users[current].y, users[current].xVel, users[current].yVel);
        if(!contains(enemyPlayer, enemies)) {
          enemies.push(enemyPlayer);
        }
      }
    }

    //FUNCTION CHECKS IF ANOTHER USER HAS LEFT THE GAME AND CLEARS THEM FROM THE ENEMIES ARRAY
    var hasLeft = function(player, list) {
      for(current in list) {
        if(list[current].playerName == player.playerName) {
          return true;
        }
      }

      return false;
    }

    //FUNCTION HANDLES USERS LEAVING
    var checkLeave = function() {
      for(current in enemies) {
        if(!(hasLeft(enemies[current], users))) {
          enemies.splice(current, 1);
        }
      }
    }

    //FUNCTION HANDLES DRAWING OUR IMAGES
    var draw = function() {
      if(titleScreen) {
        populateEnemies();
        checkLeave();
        context.globalAlpha = 0.2;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        room.map.draw(context, 0, 0);

        for(current in enemies) {
          enemies[current].draw(titleScreen, context, canvas.width, canvas.height);
        }
      }else{
        context.clearRect(0, 0, canvas.width, canvas.height);
    		room.map.draw(context, camera.xView, camera.yView);
    		player.draw(context, camera.xView, camera.yView);
        checkLeave();

        for(current in users) { //MEANT TO REMOVE YOURSELF FROM THE USERS
    			if(users[current].playerName == player.name) {
            delete users[current];
          }else {
            populateEnemies();
          }
        }

        for(current in enemies) { //WON'T DRAW AN ENEMY AT PLAYER LOCATION
          if(enemies[current].playerName == player.name) {
            continue;
          }else {
            enemies[current].draw(titleScreen, context, camera.xView, camera.yView);
          }
        }
      }
    }

    //FUNCTION HANDLES WHEN THE USER HAS CLICKED THE SUBMIT BUTTON
    var createPlayer = function() {
      titleScreen = false;
      var name = document.getElementById('input').value;
      var randomX = Math.floor(Math.random() * (4600 - 50 + 1)) + 50; //RANDOM SPAWN
      var randomY = Math.floor(Math.random() * (400 - 50 + 1)) + 50;
      player = new Game.Player(name, floors, randomX, randomY); //CREATING OUR PLAYER

      camera = new Game.Camera(0, 0, canvas.width, canvas.height, room.width, room.height); //CREATING THE CAMERA
      camera.follow(player, canvas.width/2, canvas.height/2); //FOLLOWING THE PLAYER

      document.body.removeChild(button);
      document.body.removeChild(input);

      room.map.title = false;
      reset();
    }

    //FUNCTION HANDLES RESETTING CANVAS TO NOW DRAW THE PLAYING SCREEN
    var reset = function() {
      canvas = document.getElementById('canvas1');
      context = canvas.getContext("2d");
      context.globalAlpha = 1;
    }

    //FUNCTION HANDLES UPDATING AND DRAWING EVERYTHING IN THE GAME
    var gameLoop = function() {
      button.onclick = function() {
        createPlayer();
      }

      update();
      draw();
      if(!titleScreen) {
        player.sendMessage();
      }
      else {
        sendMessage();
      }
    }


    //FUNCTION HANDLES SENDING A MESSAGE WHEN A USER IS CONNECTED AND ON THE TITLE SCREEN
    var sendMessage = function() {
      var playerX = 0;
  		var playerY = 0;
  		var message = {playerName: 0, x : playerX, y : playerY, xVel : 0, yVel : 0};
  		ws.send(JSON.stringify(message));
    }

    //FUNCTION HANDLES UPDATING OUR GAME WITHIN AN INTERVAL
    Game.play = function() {
      runningId = setInterval(function() {
        gameLoop();
      }, INTERVAL);
    }
})();

window.addEventListener("keydown", function(e){//HANDLES KEY DOWN EVENT
    keyDown[e.which] = true;
}, false);

window.addEventListener("keyup", function(e){//HANDLES KEY UP EVENT
    if(e.which == 32) {
      keyDown.clicked++; //DOUBLE JUMP CHECKER
    }
    delete keyDown[e.which];
}, false);

//WHEN RECEIVING A MESSAGE FROM THE SERVER, UPDATE OUR CURRENT USERS
var ws = new WebSocket('ws://' + window.document.location.host);
ws.onmessage = function(message) {
	  var newMsg = JSON.parse(message.data);
	  users = newMsg;
};

//STARTS THE GAME
window.onload = function(){
		Game.play();
}
