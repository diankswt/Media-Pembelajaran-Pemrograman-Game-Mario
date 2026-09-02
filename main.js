/*
 * -------------------------------------------
 * BASE CLASS
 * -------------------------------------------
 */
var Base = Class.extend({
	init: function(x, y) {
		this.setPosition(x || 0, y || 0);
		this.clearFrames();
		this.frameCount = 0;
	},
	setPosition: function(x, y) {
		this.x = x;
		this.y = y;
	},
	getPosition: function() {
		return { x : this.x, y : this.y };
	},
	setImage: function(img, x, y) {
		this.image = {
			path : img,
			x : x,
			y : y
		};
	},
	setSize: function(width, height) {
		this.width = width;
		this.height = height;
	},
	getSize: function() {
		return { width: this.width, height: this.height };
	},
	setupFrames: function(fps, frames, rewind, id) {
		if(id) {
			if(this.frameID === id)
				return true;
			
			this.frameID = id;
		}
		
		this.currentFrame = 0;
		this.frameTick = frames ? (1000 / fps / constants.interval) : 0;
		this.frames = frames;
		this.rewindFrames = rewind;
		return false;
	},
	clearFrames: function() {
		this.frameID = undefined;
		this.frames = 0;
		this.currentFrame = 0;
		this.frameTick = 0;
	},
	playFrame: function() {
		if(this.frameTick && this.view) {
			this.frameCount++;
			
			if(this.frameCount >= this.frameTick) {			
				this.frameCount = 0;
				
				if(this.currentFrame === this.frames)
					this.currentFrame = 0;
					
				var $el = this.view;
				$el.css('background-position', '-' + (this.image.x + this.width * ((this.rewindFrames ? this.frames - 1 : 0) - this.currentFrame)) + 'px -' + this.image.y + 'px');
				this.currentFrame++;
			}
		}
	},
});

/*
 * -------------------------------------------
 * GAUGE CLASS
 * -------------------------------------------
 */
var Gauge = Base.extend({
	init: function(id, startImgX, startImgY, fps, frames, rewind) {
		this._super(0, 0);
		this.view = $('#' + id);
		this.setSize(this.view.width(), this.view.height());
		this.setImage(this.view.css('background-image'), startImgX, startImgY);
		this.setupFrames(fps, frames, rewind);
	},
});

/*
 * -------------------------------------------
 * LEVEL CLASS
 * -------------------------------------------
 */
var Level = Base.extend({
	init: function(id) {
		this.world = $('#' + id);
		this.nextCycles = 0;
		this._super(0, 0);
		this.active = false;
		this.figures = [];
		this.obstacles = [];
		this.decorations = [];
		this.items = [];
		this.coinGauge = new Gauge('coin', 0, 0, 10, 4, true);
		this.liveGauge = new Gauge('live', 0, 430, 6, 6, true);
	},

	reload: function() {
    var settings = {};
    this.pause();
    clearInterval(this.loop);
    this.loop = undefined;
    
    for(var i = this.figures.length; i--; ) {
        if(this.figures[i] instanceof Mario) {
            settings.lifes = this.figures[i].lifes - 1;
            settings.coins = this.figures[i].coins;
            break;
        }
    }
    
    var levelToLoad = this.raw;
    var levelId = levelToLoad.id !== undefined ? levelToLoad.id : 0;

    // Nyawa habis kalau lifes sudah -1 (asalnya 0, dikurangi 1)
    var nyawaHabis = (settings.lifes < 0);

    if (nyawaHabis) {
        // Hapus semua checkpoint → mulai dari awal
        localStorage.removeItem('cp_level' + levelId + '_num');
        localStorage.removeItem('cp_level' + levelId + '_x');
        localStorage.removeItem('cp_level' + levelId + '_y');
        // Reset skor dan koin di DB langsung
        if (typeof currentPlayer !== 'undefined' && currentPlayer && currentPlayer.id) {
            fetch('api/simpan_nilai.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siswa_id: currentPlayer.id,
                    topik: typeof gameMode !== 'undefined' ? gameMode : 'percabangan',
                    skor: 0, total_soal: 0, benar: 0,
                    skor_materi: 0, skor_soal: 0, skor_compiler: 0, koin: 0
                })
            }).catch(function() {});
            // Reset skor lokal juga
            if (typeof skorMateri !== 'undefined') skorMateri = 0;
            if (typeof skorSoal !== 'undefined') skorSoal = 0;
            if (typeof skorCompiler !== 'undefined') skorCompiler = 0;
        }
    }

    // Ambil checkpoint terakhir yang dilewati
    var cpNum = parseInt(localStorage.getItem('cp_level' + levelId + '_num')) || 0;
    var cpX   = parseInt(localStorage.getItem('cp_level' + levelId + '_x'))   || 0;
    var cpY = parseInt(localStorage.getItem('cp_level' + levelId + '_y')) || 32;

    this.reset();
    this.load(levelToLoad);

    // Tandai semua checkpoint sampai checkpoint terakhir yang disimpan agar tidak ter-activate ulang
    if (!nyawaHabis && cpNum > 0 && this.checkpoints) {
        for (var j = 0; j < this.checkpoints.length; j++) {
            if (this.checkpoints[j].cpNumber <= cpNum) {
                this.checkpoints[j].activated = true;
                this.checkpoints[j].view.find('.cp-flag-' + this.checkpoints[j].cpNumber).css('background', '#27ae60');
            }
        }
    }
    
    for(var i = this.figures.length; i--; ) {
        if(this.figures[i] instanceof Mario) {
            this.figures[i].setLifes(nyawaHabis ? constants.start_lives : settings.lifes);
            // Koin: reset ke 0 kalau nyawa habis, pertahankan kalau masih ada nyawa
            this.figures[i].setCoins(nyawaHabis ? 0 : (settings.coins || 0));
            // Spawn di checkpoint terakhir kalau ada
            if (!nyawaHabis && cpNum > 0) {
                this.figures[i].setPosition(cpX, cpY);
            }
            break;
        }
    }
    
    this.start();
},

	load: function(level) {
		if(this.active) {
			if(this.loop)
				this.pause();

			this.reset();
		}
			
		this.setPosition(0, 0);
		this.setSize(level.width * 32, level.height * 32);
		this.setImage(level.background);
		this.raw = level;
		this.id = level.id;
		this.active = true;
		this.obstacles = [];
		this.figures = [];
		this.items = [];
		this.decorations = [];
		this.checkpoints = [];
		var data = level.data;
		var actualWidth = Math.max(level.width, data.length);
		var actualHeight = level.height;
		for(var i = 0; i < data.length && actualHeight < data[i].length; i++) {
			actualHeight = data[i].length;
		}
		
		for(var i = 0; i < actualWidth; i++) {
			var t = [];
			for(var j = 0; j < actualHeight; j++) {
				t.push('');
			}
			this.obstacles.push(t);
		}
		
		for(var i = 0, width = data.length; i < width; i++) {
			var col = data[i];
			
			for(var j = 0, height = col.length; j < height; j++) {
				if(reflection[col[j]])
					new (reflection[col[j]])(i * 32, (height - j - 1) * 32, this);
			}
		}
	},
	next: function() {
		this.nextCycles = Math.floor(7000 / constants.interval);
	},
	nextLoad: function() {
		if(this.nextCycles)
			return;
		if(window._levelCompleteShowing) return;
		if(currentLevels.length > 0 && this.id === currentLevels[currentLevels.length-1].id) return;
		
		var settings = {};
		this.pause();
		
		for(var i = this.figures.length; i--; ) {
			if(this.figures[i] instanceof Mario) {
				settings.lifes = this.figures[i].lifes;
				settings.coins = this.figures[i].coins;
				settings.state = this.figures[i].state;
				settings.marioState = this.figures[i].marioState;
				break;
			}
		}
		
		this.reset();
		var nextLvl = null;
		for (var ni = 0; ni < currentLevels.length; ni++) {
			if (currentLevels[ni].id === this.id + 1) { nextLvl = currentLevels[ni]; break; }
		}
		if (nextLvl) this.load(nextLvl);
		
		for(var i = this.figures.length; i--; ) {
			if(this.figures[i] instanceof Mario) {
				this.figures[i].setLifes(settings.lifes || 0);
				this.figures[i].setCoins(settings.coins || 0);
				this.figures[i].setState(settings.state || size_states.small);
				this.figures[i].setMarioState(settings.marioState || mario_states.normal);
				break;
			}
		}
		
		this.start();
	},
	getGridWidth: function() {
		return this.raw.width;
	},
	getGridHeight: function() {
		return this.raw.height;
	},
	setSounds: function(manager) {
		this.sounds = manager;
	},
	playSound: function(label) {
		if(this.sounds)
			this.sounds.play(label);
	},
	playMusic: function(label) {
		if(this.sounds)
			this.sounds.sideMusic(label);
	},
	reset: function() {
		this.active = false;
		this.world.empty();
		this.figures = [];
		this.obstacles = [];
		this.items = [];
		this.decorations = [];
		this.checkpoints = [];
	},
	tick: function() {
		if(this.nextCycles) {
			this.nextCycles--;
			this.nextLoad();			
			return;
		}
		
		var i = 0, j = 0, figure, opponent;
		
		for(i = this.figures.length; i--; ) {
			figure = this.figures[i];
			
			if(figure.dead) {
				if(!figure.death()) {
					if(figure instanceof Mario)
						return this.reload();
						
					figure.view.remove();
					this.figures.splice(i, 1);
				} else
					figure.playFrame();
			} else {
				if(i) {
					for(j = i; j--; ) {
						if(figure.dead)
							break;
							
						opponent = this.figures[j];
						
						if(!opponent.dead && q2q(figure, opponent)) {
							figure.hit(opponent);
							opponent.hit(figure);
						}
					}
				}
			}
			
			if(!figure.dead) {
				figure.move();
				figure.playFrame();
			}
		}
		
		for(i = this.items.length; i--; )
			this.items[i].playFrame();

		// Cek checkpoint — apakah Mario sudah lewat bendera
		if (this.checkpoints && this.checkpoints.length) {
			var mario = null;
			for (i = this.figures.length; i--; ) {
				if (this.figures[i] instanceof Mario && !this.figures[i].dead) {
					mario = this.figures[i];
            break;
        }
    }
    if (mario) {
        for (i = this.checkpoints.length; i--; ) {
            this.checkpoints[i].checkTouch(mario);
        }
    }
}
		
		this.coinGauge.playFrame();
		this.liveGauge.playFrame();
	},
	start: function() {
		var me = this;
		clearInterval(me.loop);
		me.loop = setInterval(function() {
			me.tick.apply(me);
		}, constants.interval);
	},
	pause: function() {
		clearInterval(this.loop);
		this.loop = undefined;
	},
	setPosition: function(x, y) {
		this._super(x, y);
		this.world.css('left', -x);
	},
	setImage: function(index) {
		var img = BASEPATH + 'backgrounds/' + ((index < 10 ? '0' : '') + index) + '.png';
		this.world.parent().css({
			backgroundImage : c2u(img),
			backgroundPosition : '0 -380px'
		});
		this._super(img, 0, 0);
	},
	setSize: function(width, height) {
		this._super(width, height);
	},
	setParallax: function(x) {
		this.setPosition(x, this.y);
		this.world.parent().css('background-position', '-' + Math.floor(x / 3) + 'px -380px');
	},
});

/*
 * -------------------------------------------
 * FIGURE CLASS
 * -------------------------------------------
 */
var Figure = Base.extend({
	init: function(x, y, level) {
		this.view = $(DIV).addClass(CLS_FIGURE).appendTo(level.world);
		this.dx = 0;
		this.dy = 0;
		this.dead = false;
		this.onground = true;
		this.setState(size_states.small);
		this.setVelocity(0, 0);
		this.direction = directions.none;
		this.level = level;
		this._super(x, y);
		level.figures.push(this);
	},
	setState: function(state) {
		this.state = state;
	},
	setImage: function(img, x, y) {
		this.view.css({
			backgroundImage : img ? c2u(img) : 'none',
			backgroundPosition : '-' + (x || 0) + 'px -' + (y || 0) + 'px',
		});
		this._super(img, x, y);
	},
	setOffset: function(dx, dy) {
		this.dx = dx;
		this.dy = dy;
		this.setPosition(this.x, this.y);
	},
	setPosition: function(x, y) {
		this.view.css({
			left: x,
			bottom: y,
			marginLeft: this.dx,
			marginBottom: this.dy,
		});
		this._super(x, y);
		this.setGridPosition(x, y);
	},
	setSize: function(width, height) {
		this.view.css({
			width: width,
			height: height
		});
		this._super(width, height);
	},
	setGridPosition: function(x, y) {
		this.i = Math.floor((x + 16) / 32);
		this.j = Math.ceil(this.level.getGridHeight() - 1 - y / 32);
		
		if(this.j > this.level.getGridHeight())
			this.die();
	},
	getGridPosition: function(x, y) {
		return { i : this.i, j : this.j };
	},
	setVelocity: function(vx, vy) {
		this.vx = vx;
		this.vy = vy;
		
		if(vx > 0)
			this.direction = directions.right;
		else if(vx < 0)
			this.direction = directions.left;
	},
	getVelocity: function() {
		return { vx : this.vx, vy : this.vy };
	},
	hit: function(opponent) {
		
	},
	collides: function(is, ie, js, je, blocking) {
		var isHero = this instanceof Hero;
		
		if(is < 0 || ie >= this.level.obstacles.length)
			return true;
			
		if(js < 0 || je >= this.level.getGridHeight())
			return false;
			
		for(var i = is; i <= ie; i++) {
			for(var j = je; j >= js; j--) {
				var obj = this.level.obstacles[i][j];
				
				if(obj) {
					if(obj instanceof Item && isHero && (blocking === ground_blocking.bottom || obj.blocking === ground_blocking.none))
						obj.activate(this);
					
					if((obj.blocking & blocking) === blocking)
						return true;
				}
			}
		}
		
		return false;
	},
	move: function() {
		var vx = this.vx;
		var vy = this.vy - constants.gravity;
		
		var s = this.state;
		
		var x = this.x;
		var y = this.y;
		
		var dx = Math.sign(vx);
		var dy = Math.sign(vy);
		
		var is = this.i;
		var ie = is;
		
		var js = Math.ceil(this.level.getGridHeight() - s - (y + 31) / 32);
		var je = this.j;
		
		var d = 0, b = ground_blocking.none;
		var onground = false;
		var t = Math.floor((x + 16 + vx) / 32);
		
		if(dx > 0) {
			d = t - ie;
			t = ie;
			b = ground_blocking.left;
		} else if(dx < 0) {
			d = is - t;
			t = is;
			b = ground_blocking.right;
		}
		
		x += vx;
		
		for(var i = 0; i < d; i++) {
			if(this.collides(t + dx, t + dx, js, je, b)) {
				vx = 0;
				x = t * 32 + 15 * dx;
				break;
			}
			
			t += dx;
			is += dx;
			ie += dx;
		}
		
		if(dy > 0) {
			t = Math.ceil(this.level.getGridHeight() - s - (y + 31 + vy) / 32);
			d = js - t;
			t = js;
			b = ground_blocking.bottom;
		} else if(dy < 0) {
			t = Math.ceil(this.level.getGridHeight() - 1 - (y + vy) / 32);
			d = t - je;
			t = je;
			b = ground_blocking.top;
		} else
			d = 0;
		
		y += vy;
		
		for(var i = 0; i < d; i++) {
			if(this.collides(is, ie, t - dy, t - dy, b)) {
				onground = dy < 0;
				vy = 0;
				y = this.level.height - (t + 1) * 32 - (dy > 0 ? (s - 1) * 32 : 0);
				break;
			}
			
			t -= dy;
		}
		
		this.onground = onground;
		this.setVelocity(vx, vy);
		this.setPosition(x, y);
	},
	death: function() {
		return false;
	},
	die: function() {
		this.dead = true;
	},
});

/*
 * -------------------------------------------
 * MATTER CLASS
 * -------------------------------------------
 */
var Matter = Base.extend({
	init: function(x, y, blocking, level) {
		this.blocking = blocking;
		this.view = $(DIV).addClass(CLS_MATTER).appendTo(level.world);
		this.level = level;
		this._super(x, y);
		this.setSize(32, 32);
		this.addToGrid(level);
	},
	addToGrid: function(level) {
		level.obstacles[this.x / 32][this.level.getGridHeight() - 1 - this.y / 32] = this;
	},
	setImage: function(img, x, y) {
		this.view.css({
			backgroundImage : img ? c2u(img) : 'none',
			backgroundPosition : '-' + (x || 0) + 'px -' + (y || 0) + 'px',
		});
		this._super(img, x, y);
	},
	setPosition: function(x, y) {
		this.view.css({
			left: x,
			bottom: y
		});
		this._super(x, y);
	},
});

/*
 * -------------------------------------------
 * GROUND CLASS
 * -------------------------------------------
 */
var Ground = Matter.extend({
	init: function(x, y, blocking, level) {
		this._super(x, y, blocking, level);
	},
});

/*
 * -------------------------------------------
 * GRASS CLASSES
 * -------------------------------------------
 */
var TopGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.top;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 888, 404);
	},
}, 'grass_top');
var TopRightGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.top + ground_blocking.right;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 922, 404);
	},
}, 'grass_top_right');
var TopLeftGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.left + ground_blocking.top;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 854, 404);
	},
}, 'grass_top_left');
var RightGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.right;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 922, 438);
	},
}, 'grass_right');
var LeftGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.left;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 854, 438);
	},
}, 'grass_left');
var TopRightRoundedGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.top;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 922, 506);
	},
}, 'grass_top_right_rounded');
var TopLeftRoundedGrass = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.top;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 854, 506);
	},
}, 'grass_top_left_rounded');

/*
 * -------------------------------------------
 * STONE CLASSES
 * -------------------------------------------
 */
var Stone = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.all;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 550, 160);
	},
}, 'stone');
var BrownBlock = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.all;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 514, 194);
	},
}, 'brown_block');

/*
 * -------------------------------------------
 * PIPE CLASSES
 * -------------------------------------------
 */
var RightTopPipe = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.all;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 36, 358);
	},
}, 'pipe_top_right');
var LeftTopPipe = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.all;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 2, 358);
	},
}, 'pipe_top_left');
var RightPipe = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.right + ground_blocking.bottom;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 36, 390);
	},
}, 'pipe_right');
var LeftPipe = Ground.extend({
	init: function(x, y, level) {
		var blocking = ground_blocking.left + ground_blocking.bottom;
		this._super(x, y, blocking, level);
		this.setImage(images.objects, 2, 390);
	},
}, 'pipe_left');

/*
 * -------------------------------------------
 * DECORATION CLASS
 * -------------------------------------------
 */
var Decoration = Matter.extend({
	init: function(x, y, level) {
		this._super(x, y, ground_blocking.none, level);
		level.decorations.push(this);
	},
	setImage: function(img, x, y) {
		this.view.css({
			backgroundImage : img ? c2u(img) : 'none',
			backgroundPosition : '-' + (x || 0) + 'px -' + (y || 0) + 'px',
		});
		this._super(img, x, y);
	},
	setPosition: function(x, y) {
		this.view.css({
			left: x,
			bottom: y
		});
		this._super(x, y);
	},
});

/*
 * -------------------------------------------
 * DECORATION GRASS CLASSES
 * -------------------------------------------
 */
var TopRightCornerGrass = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 612, 868);
	},
}, 'grass_top_right_corner');
var TopLeftCornerGrass = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 648, 868);
	},
}, 'grass_top_left_corner');

/*
 * -------------------------------------------
 * SOIL CLASSES
 * -------------------------------------------
 */
var Soil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 888, 438);
	},
}, 'soil');
var RightSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 922, 540);
	},
}, 'soil_right');
var LeftSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 854,540);
	},
}, 'soil_left');

/*
 * -------------------------------------------
 * BUSH CLASSES
 * -------------------------------------------
 */
var RightBush = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 382, 928);
	},
}, 'bush_right');
var RightMiddleBush = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 314, 928);
	},
}, 'bush_middle_right');
var MiddleBush = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 348, 928);
	},
}, 'bush_middle');
var LeftMiddleBush = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 212, 928);
	},
}, 'bush_middle_left');
var LeftBush = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 178, 928);
	},
}, 'bush_left');

/*
 * -------------------------------------------
 * GRASS-SOIL CLASSES
 * -------------------------------------------
 */
var TopRightGrassSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 990, 506);
	},
}, 'grass_top_right_rounded_soil');
var TopLeftGrassSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 956, 506);
	},
}, 'grass_top_left_rounded_soil');

/*
 * -------------------------------------------
 * PLANTED SOIL CLASSES
 * -------------------------------------------
 */
var RightPlantedSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 782, 832);
	},
}, 'planted_soil_right');
var MiddlePlantedSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 748, 832);
	},
}, 'planted_soil_middle');
var LeftPlantedSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 714, 832);
	},
}, 'planted_soil_left');

/*
 * -------------------------------------------
 * PIPE DECORATION
 * -------------------------------------------
 */
var RightPipeGrass = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 36, 424);
	},
}, 'pipe_right_grass');
var LeftPipeGrass = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 2, 424);
	},
}, 'pipe_left_grass');
var RightPipeSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 36, 458);
	},
}, 'pipe_right_soil');
var LeftPipeSoil = Decoration.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 2, 458);
	},
}, 'pipe_left_soil');

/*
 * -------------------------------------------
 * ITEM CLASS
 * -------------------------------------------
 */
var Item = Matter.extend({
	init: function(x, y, isBlocking, level) {
		this.isBouncing = false;
		this.bounceCount = 0;
		this.bounceFrames = Math.floor(50 / constants.interval);
		this.bounceStep = Math.ceil(10 / this.bounceFrames);
		this.bounceDir = 1;
		this.isBlocking = isBlocking;
		this._super(x, y, isBlocking ? ground_blocking.all : ground_blocking.none, level);
		this.activated = false;
		this.addToLevel(level);
	},
	addToLevel: function(level) {
		level.items.push(this);
	},
	activate: function(from) {
		this.activated = true;
	},
	bounce: function() {
		this.isBouncing = true;
		
		for(var i = this.level.figures.length; i--; ) {
			var fig = this.level.figures[i];
			
			if(fig.y === this.y + 32 && fig.x >= this.x - 16 && fig.x <= this.x + 16) {
				if(fig instanceof ItemFigure)
					fig.setVelocity(fig.vx, constants.bounce);
				else
					fig.die();
			}
		}
	},
	playFrame: function() {
		if(this.isBouncing) {
			this.view.css({ 'bottom' : (this.bounceDir > 0 ? '+' : '-') + '=' + this.bounceStep + 'px' });
			this.bounceCount += this.bounceDir;
			
			if(this.bounceCount === this.bounceFrames)
				this.bounceDir = -1;
			else if(this.bounceCount === 0) {
				this.bounceDir = 1;
				this.isBouncing = false;
			}
		}
		
		this._super();
	},
});

/*
 * -------------------------------------------
 * COIN CLASSES
 * -------------------------------------------
 */
var Coin = Item.extend({
	init: function(x, y, level) {
		this._super(x, y, false, level);
		this.setImage(images.objects, 0, 0);
		this.setupFrames(10, 4, true);
	},
	activate: function(from) {
		if(!this.activated) {
			this.level.playSound('coin');
			from.addCoin();
			this.remove();
		}
		this._super(from);
	},
	remove: function() {
		this.view.remove();
	},
}, 'coin');
var CoinBoxCoin = Coin.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setImage(images.objects, 96, 0);
		this.clearFrames();
		this.view.hide();
		this.count = 0;
		this.frames = Math.floor(150 / constants.interval);
		this.step = Math.ceil(30 / this.frames);
	},
	remove: function() { },
	addToGrid: function() { },
	addToLevel: function() { },
	activate: function(from) {
		this._super(from);
		this.view.show().css({ 'bottom' : '+=8px' });
	},
	act: function() {
		this.view.css({ 'bottom' : '+=' + this.step + 'px' });
		this.count++;
		return (this.count === this.frames);
	},
});
var CoinBox = Item.extend({
	init: function(x, y, level, amount) {
		this._super(x, y, true, level);
		this.setImage(images.objects, 346, 328);
		this.setAmount(amount || 1);
	},
	setAmount: function(amount) {
		this.items = [];
		this.actors = [];
		
		for(var i = 0; i < amount; i++)
			this.items.push(new CoinBoxCoin(this.x, this.y, this.level));
	},
	activate: function(from) {
		if(!this.isBouncing) {
			if(this.items.length) {
				this.bounce();
				var coin = this.items.pop();
				coin.activate(from);
				this.actors.push(coin);
				
				if(!this.items.length)
					this.setImage(images.objects, 514, 194);
			}
		}
			
		this._super(from);
	},
	playFrame: function() {
		for(var i = this.actors.length; i--; ) {
			if(this.actors[i].act()) {
				this.actors[i].view.remove();
				this.actors.splice(i, 1);
			}
		}
		
		this._super();
	},
}, 'coinbox');
var MultipleCoinBox = CoinBox.extend({
	init: function(x, y, level) {
		this._super(x, y, level, 8);
	},
}, 'multiple_coinbox');

var MateriBox = Item.extend({
    init: function(x, y, level) {
        this._super(x, y, true, level);
        this.slotNumber = 1;
        var levelId = (level && level.id !== undefined) ? level.id : 0;
        var key = 'materi_opened_' + levelId + '_slot_' + this.slotNumber;
        if (localStorage.getItem(key)) {
            // Sudah pernah dibuka → tampil kotak biasa langsung
            this.activated = true;
            this.setImage(images.objects, 514, 194);
            this.view.css('filter', 'none');
        } else {
            this.setImage(images.objects, 346, 328);
            this.view.css('filter', 'hue-rotate(200deg) saturate(1.5)');
        }
    },
    activate: function(from) {
        if (!this.activated) {
            this.bounce();
            this.setImage(images.objects, 514, 194);
            this.view.css('filter', 'none');
            var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
            localStorage.setItem('materi_opened_' + levelId + '_slot_' + this.slotNumber, '1');
            if (typeof showMateriPopup === 'function') showMateriPopup(this.slotNumber);
        }
        this._super(from);
    },
}, 'materi_box');

// Daftarkan materi_box_1 sampai materi_box_6 - percabangan
(function() {
    for (var i = 1; i <= 6; i++) {
        (function(slot) {
            reflection['materi_box_' + slot] = Item.extend({
                init: function(x, y, level) {
                    this._super(x, y, true, level);
                    this.slotNumber = slot;
                    var levelId = (level && level.id !== undefined) ? level.id : 0;
                    var key = 'materi_opened_' + levelId + '_slot_' + slot;
                    if (localStorage.getItem(key)) {
                        // Sudah pernah dibuka → kotak biasa
                        this.activated = true;
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                    } else {
                        this.setImage(images.objects, 346, 328);
                        this.view.css('filter', 'hue-rotate(200deg) saturate(1.5)');
                    }
                },
                activate: function(from) {
                    if (!this.activated) {
                        this.bounce();
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                        var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                        localStorage.setItem('materi_opened_' + levelId + '_slot_' + slot, '1');
                        if (typeof showMateriPopup === 'function') showMateriPopup(this.slotNumber);
                    }
                    this._super(from);
                },
            });
        })(i);
    }
})();

// Daftarkan materi_box_1 sampai materi_box_5 - perulangan
(function() {
    for (var i = 1; i <= 5; i++) {
        (function(slot) {
            reflection['materi_box_loop_' + slot] = Item.extend({
                init: function(x, y, level) {
                    this._super(x, y, true, level);
                    this.slotNumber = slot;
                    var levelId = (level && level.id !== undefined) ? level.id : 0;
                    var key = 'materi_opened_loop_' + levelId + '_slot_' + slot;
                    if (localStorage.getItem(key)) {
                        // Sudah pernah dibuka → kotak biasa
                        this.activated = true;
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                    } else {
                        this.setImage(images.objects, 346, 328);
                        this.view.css('filter', 'hue-rotate(200deg) saturate(1.5)');
                    }
                },
                activate: function(from) {
                    if (!this.activated) {
                        this.bounce();
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                        var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                        localStorage.setItem('materi_opened_loop_' + levelId + '_slot_' + slot, '1');
                        if (typeof showMateriPopup === 'function') showMateriPopup(this.slotNumber);
                    }
                    this._super(from);
                },
            });
        })(i);
    }
})();

// ===== SOAL BOX =====
// soal_box untuk percabangan (level id 1)
(function() {
    for (var i = 1; i <= 7; i++) {
        (function(slot) {
            reflection['soal_box_' + slot] = Item.extend({
                init: function(x, y, level) {
                    this._super(x, y, true, level);
                    this.slotNumber = slot;
                    var levelId = (level && level.id !== undefined) ? level.id : 0;
                    var key = 'soal_opened_' + levelId + '_slot_' + slot;
                    if (localStorage.getItem(key)) {
                        this.activated = true;
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                    } else {
                        this.setImage(images.objects, 346, 328);
                        this.view.css('filter', 'hue-rotate(340deg) saturate(2)');
                    }
                },
                activate: function(from) {
                    if (!this.activated) {
                        this.bounce();
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                        var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                        localStorage.setItem('soal_opened_' + levelId + '_slot_' + slot, '1');
                        showQuestionBySlot(from, this.slotNumber, 'percabangan');
                    }
                    this._super(from);
                },
            });
        })(i);
    }
})();

// soal_box untuk percabangan (level id 3)
(function() {
    for (var i = 1; i <= 7; i++) {
        (function(slot) {
            reflection['soal_box_loop_' + slot] = Item.extend({
                init: function(x, y, level) {
                    this._super(x, y, true, level);
                    this.slotNumber = slot;
                    var levelId = (level && level.id !== undefined) ? level.id : 0;
                    var key = 'soal_opened_loop_' + levelId + '_slot_' + slot;
                    if (localStorage.getItem(key)) {
                        this.activated = true;
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                    } else {
                        this.setImage(images.objects, 346, 328);
                        this.view.css('filter', 'hue-rotate(340deg) saturate(2)');
                    }
                },
                activate: function(from) {
                    if (!this.activated) {
                        this.bounce();
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                        var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                        localStorage.setItem('soal_opened_loop_' + levelId + '_slot_' + slot, '1');
                        showQuestionBySlot(from, this.slotNumber, 'perulangan');
                    }
                    this._super(from);
                },
            });
        })(i);
    }
})();
// ===== END SOAL BOX =====

// ===== CHECKPOINT FLAG =====
var checkpointData = { 1: null, 2: null };

function buatCheckpoint(nomor) {
    return Matter.extend({
        init: function(x, y, level) {
            this._super(x, y, 0, level);
            this.cpNumber = nomor;
            this.activated = false;
            this.view.css({
                'width': '20px',
                'height': '48px',
                'background': 'transparent',
                'position': 'absolute',
                'z-index': '50',
            });
            this.view.html(
                '<div style="width:4px;height:48px;background:#fff;margin:0 auto;position:relative;">' +
                '<div class="cp-flag-' + nomor + '" style="width:16px;height:12px;background:' + (nomor === 1 ? '#f1c40f' : '#e74c3c') + ';position:absolute;top:0;left:4px;"></div>' +
                '<div style="font-family:PS2P,sans-serif;font-size:5px;color:#fff;position:absolute;top:14px;left:6px;white-space:nowrap;">' + nomor + '</div>' +
                '</div>'
            );
            checkpointData[nomor] = Math.floor(x);
            // Daftarkan ke level.checkpoints supaya bisa dicek di tick
            if (!level.checkpoints) level.checkpoints = [];
            level.checkpoints.push(this);
        },
        checkTouch: function(mario) {
            if (this.activated) return;
            // Cek apakah Mario sudah melewati posisi X bendera ini
            if (mario.x >= this.x) {
                this.activated = true;
                // Ubah warna bendera jadi hijau
                this.view.find('.cp-flag-' + this.cpNumber).css('background', '#27ae60');
                var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                // Simpan checkpoint dengan key yang SAMA seperti yang dibaca di reload()
                localStorage.setItem('cp_level' + levelId + '_num', this.cpNumber);
                localStorage.setItem('cp_level' + levelId + '_x', checkpointData[this.cpNumber]);
                localStorage.setItem('cp_level' + levelId + '_y', Math.floor(mario.y));
                // Notif teks
                var cpNum = this.cpNumber;
                var cpX = this.x;
                var cpY = this.y;
                var world = this.level.world;
                var $notif = $('<div>').text('Checkpoint ' + cpNum + '!').css({
                    position: 'absolute',
                    left: cpX + 'px',
                    top: (cpY + 20) + 'px',
                    'font-family': 'PS2P,sans-serif',
                    'font-size': '8px',
                    color: '#27ae60',
                    'z-index': 9999,
                    'pointer-events': 'none',
                    'text-shadow': '1px 1px 0 #000',
                });
                world.append($notif);
                setTimeout(function() { $notif.remove(); }, 1500);
            }
        },
    });
}

reflection['checkpoint_1'] = buatCheckpoint(1);
reflection['checkpoint_2'] = buatCheckpoint(2);
// ===== END CHECKPOINT FLAG =====

// ===== COMPILER BOX =====
(function() {
    for (var i = 1; i <= 7; i++) {
        (function(slot) {
            reflection['compiler_box_' + slot] = Item.extend({
                init: function(x, y, level) {
                    this._super(x, y, true, level);
                    this.slotNumber = slot;
                    var levelId = (level && level.id !== undefined) ? level.id : 0;
                    var key = 'compiler_opened_' + levelId + '_slot_' + slot;
                    if (localStorage.getItem(key)) {
                        this.activated = true;
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                    } else {
                        this.setImage(images.objects, 346, 328);
                        this.view.css('filter', 'hue-rotate(270deg) saturate(2) brightness(1.2)');
                    }
                },
                activate: function(from) {
                    if (!this.activated) {
                        this.activated = true;
                        this.bounce();
                        this.setImage(images.objects, 514, 194);
                        this.view.css('filter', 'none');
                        var levelId = (this.level && this.level.id !== undefined) ? this.level.id : 0;
                        localStorage.setItem('compiler_opened_' + levelId + '_slot_' + slot, '1');
                        var topik = (this.level && this.level.id <= 1) ? 'percabangan' : 'perulangan';
                        showCompilerPopup(topik);
                    }
                    this._super(from);
                },
            });
        })(i);
    }
})();
// ===== END COMPILER BOX =====

/*
 * -------------------------------------------
 * ITEMFIGURE CLASS
 * -------------------------------------------
 */
var ItemFigure = Figure.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
	},
});

/*
 * -------------------------------------------
 * STARBOX CLASS
 * -------------------------------------------
 */
var StarBox = Item.extend({
	init: function(x, y, level) {
		this._super(x, y, true, level);
		this.setImage(images.objects, 96, 33);
		this.star = new Star(x, y, level);
		this.setupFrames(8, 4, false);
	},
	activate: function(from) {
		if(!this.activated) {
			this.star.release();
			this.clearFrames();
			this.bounce();
			this.setImage(images.objects, 514, 194);
		}
		
		this._super(from);
	},
}, 'starbox');
var Star = ItemFigure.extend({
	init: function(x, y, level) {
		this._super(x, y + 32, level);
		this.active = false;
		this.setSize(32, 32);
		this.setImage(images.objects, 32, 69);
		this.view.hide();
	},
	release: function() {
		this.taken = 4;
		this.active = true;
		this.level.playSound('mushroom');
		this.view.show();
		this.setVelocity(constants.star_vx, constants.star_vy);
		this.setupFrames(10, 2, false);
	},
	collides: function(is, ie, js, je, blocking) {
		return false;
	},
	move: function() {
		if(this.active) {
			this.vy += this.vy <= -constants.star_vy ? constants.gravity : constants.gravity / 2;
			this._super();
		}
		
		if(this.taken)
			this.taken--;
	},
	hit: function(opponent) {
		if(!this.taken && this.active && opponent instanceof Mario) {
			opponent.invincible();
			this.die();
		}
	},
});

/*
 * -------------------------------------------
 * MUSHROOMBOX CLASS
 * -------------------------------------------
 */
var MushroomBox = Item.extend({
	init: function(x, y, level) {
		this._super(x, y, true, level);
		this.setImage(images.objects, 96, 33);
		this.max_mode = mushroom_mode.plant;
		this.mushroom = new Mushroom(x, y, level);
		this.setupFrames(8, 4, false);
	},
	activate: function(from) {
		if(!this.activated) {
			if(from.state === size_states.small || this.max_mode === mushroom_mode.mushroom)
				this.mushroom.release(mushroom_mode.mushroom);
			else
				this.mushroom.release(mushroom_mode.plant);
			
			this.clearFrames();
			this.bounce();
			this.setImage(images.objects, 514, 194);
		}
			
		this._super(from);
	},
}, 'mushroombox');
var Mushroom = ItemFigure.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.active = false;
		this.setSize(32, 32);
		this.setImage(images.objects, 582, 60);
		this.released = 0;
		this.view.css('z-index', 94).hide();
	},
	release: function(mode) {
		this.released = 4;
		this.level.playSound('mushroom');
		
		if(mode === mushroom_mode.plant)
			this.setImage(images.objects, 548, 60);
			
		this.mode = mode;
		this.view.show();
	},
	move: function() {
		if(this.active) {
			this._super();
		
			if(this.mode === mushroom_mode.mushroom && this.vx === 0)
				this.setVelocity(this.direction === directions.right ? -constants.mushroom_v : constants.mushroom_v, this.vy);
		} else if(this.released) {
			this.released--;
			this.setPosition(this.x, this.y + 8);
			
			if(!this.released) {
				this.active = true;
				this.view.css('z-index', 99);
				
				if(this.mode === mushroom_mode.mushroom)
					this.setVelocity(constants.mushroom_v, constants.gravity);
			}
		}
	},
	hit: function(opponent) {
		if(this.active && opponent instanceof Mario) {
			if(this.mode === mushroom_mode.mushroom)
				opponent.grow();
			else if(this.mode === mushroom_mode.plant)
				opponent.shooter();
				
			this.die();
		}
	},
});

/*
 * -------------------------------------------
 * BULLET CLASS
 * -------------------------------------------
 */
var Bullet = Figure.extend({
	init: function(parent) {
		this._super(parent.x + 31, parent.y + 14, parent.level);
		this.parent = parent;
		this.setImage(images.sprites, 191, 366);
		this.setSize(16, 16);
		this.direction = parent.direction;
		this.vy = 0;
		this.life = Math.ceil(2000 / constants.interval);
		this.speed = constants.bullet_v;
		this.vx = this.direction === directions.right ? this.speed : -this.speed;
	},
	setVelocity: function(vx, vy) {
		this._super(vx, vy);
	
		if(this.vx === 0) {
			var s = this.speed * Math.sign(this.speed);
			this.vx = this.direction === directions.right ? -s : s;
		}
		
		if(this.onground)
			this.vy = constants.bounce;
	},
	move: function() {
		if(--this.life)
			this._super();
		else
			this.die();
	},
	hit: function(opponent) {
		if(!(opponent instanceof Mario)) {
			opponent.die();
			this.die();
		}
	},
});

/*
 * -------------------------------------------
 * HERO CLASS
 * -------------------------------------------
 */
var Hero = Figure.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
	},
});

/*
 * -------------------------------------------
 * MARIO CLASS
 * -------------------------------------------
 */
var Mario = Hero.extend({
	init: function(x, y, level) {
		this.standSprites = [
			[[{ x : 0, y : 81},{ x: 481, y : 83}],[{ x : 81, y : 0},{ x: 561, y : 83}]],
			[[{ x : 0, y : 162},{ x: 481, y : 247}],[{ x : 81, y : 243},{ x: 561, y : 247}]]
		];
		this.crouchSprites = [
			[{ x : 241, y : 0},{ x: 161, y : 0}],
			[{ x : 241, y : 162},{ x: 241, y : 243}]
		];
		this.deadly = 0;
		this.invulnerable = 0;
		this.width = 80;
		this._super(x, y, level);
		this.blinking = 0;
		this.setOffset(-24, 0);
		this.setSize(80, 80);
		this.cooldown = 0;
		this.setMarioState(mario_states.normal);
		this.setLifes(constants.start_lives);
		this.setCoins(0);
		this.deathBeginWait = Math.floor(700 / constants.interval);
		this.deathEndWait = 0;
		this.deathFrames = Math.floor(600 / constants.interval);
		this.deathStepUp = Math.ceil(200 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
		this.direction = directions.right;
		this.setImage(images.sprites, 81, 0);
		this.crouching = false;
		this.fast = false;
	},
	setMarioState: function(state) {
		this.marioState = state;
	},
	setState: function(state) {
		if(state !== this.state) {
			this.setMarioState(mario_states.normal);
			this._super(state);
		}
	},
	setPosition: function(x, y) {
		this._super(x, y);
		var r = this.level.width - 640;
		var w = (this.x <= 210) ? 0 : ((this.x >= this.level.width - 230) ? r : r / (this.level.width - 440) * (this.x - 210));		
		this.level.setParallax(w);

		if(this.onground && this.x >= this.level.width - 128)
			this.victory();
	},
	input: function(keys) {
		this.fast = keys.accelerate;
		this.crouching = keys.down;
		
		if(!this.crouching) {
			if(this.onground && keys.up)
				this.jump();
				
			if(keys.accelerate && this.marioState === mario_states.fire)
				this.shoot();
				
			if(keys.right || keys.left)
				this.walk(keys.left, keys.accelerate);
			else
				this.vx = 0;
		}
	},

	victory: function() {
		if(this._victoryDone) return;
		this._victoryDone = true;
    this.level.playMusic('success');
    this.clearFrames();
    this.view.show();
    this.setImage(images.sprites, this.state === size_states.small ? 241 : 161, 81);

    var mario = this;
    setTimeout(function() {
        showLevelComplete(mario.coins, mario.level.id);
    }, 2000);
},

	shoot: function() {
		if(!this.cooldown) {
			this.cooldown = constants.cooldown;
			this.level.playSound('shoot');
			new Bullet(this);
		}
	},
	setVelocity: function(vx, vy) {
		if(this.crouching) {
			vx = 0;
			this.crouch();
		} else {
			if(this.onground && vx > 0)
				this.walkRight();
			else if(this.onground && vx < 0)
				this.walkLeft();
			else
				this.stand();
		}
	
		this._super(vx, vy);
	},
	blink: function(times) {
		this.blinking = Math.max(2 * times * constants.blinkfactor, this.blinking || 0);
	},
	invincible: function() {
		this.level.playMusic('invincibility');
		this.deadly = Math.floor(constants.invincible / constants.interval);
		this.invulnerable = this.deadly;
		this.blink(Math.ceil(this.deadly / (2 * constants.blinkfactor)));
	},
	grow: function() {
		if(this.state === size_states.small) {
			this.level.playSound('grow');
			this.setState(size_states.big);
			this.blink(3);
		}
	},
	shooter: function() {
		if(this.state === size_states.small)
			this.grow();
		else
			this.level.playSound('grow');
			
		this.setMarioState(mario_states.fire);
	},
	walk: function(reverse, fast) {
		this.vx = constants.walking_v * (fast ? 2 : 1) * (reverse ? - 1 : 1);
	},
	walkRight: function() {
		if(this.state === size_states.small) {
			if(!this.setupFrames(8, 2, true, 'WalkRightSmall'))
				this.setImage(images.sprites, 0, 0);
		} else {
			if(!this.setupFrames(9, 2, true, 'WalkRightBig'))
				this.setImage(images.sprites, 0, 243);
		}
	},
	walkLeft: function() {
		if(this.state === size_states.small) {
			if(!this.setupFrames(8, 2, false, 'WalkLeftSmall'))
				this.setImage(images.sprites, 80, 81);
		} else {
			if(!this.setupFrames(9, 2, false, 'WalkLeftBig'))
				this.setImage(images.sprites, 81, 162);
		}
	},
	stand: function() {
		var coords = this.standSprites[this.state - 1][this.direction === directions.left ? 0 : 1][this.onground ? 0 : 1];
		this.setImage(images.sprites, coords.x, coords.y);
		this.clearFrames();
	},
	crouch: function() {
		var coords = this.crouchSprites[this.state - 1][this.direction === directions.left ? 0 : 1];
		this.setImage(images.sprites, coords.x, coords.y);
		this.clearFrames();
	},
	jump: function() {
		this.level.playSound('jump');
		this.vy = constants.jumping_v;
	},
	move: function() {
		this.input(keys);		
		this._super();
	},
	addCoin: function() {
		this.setCoins(this.coins + 1);
	},
	playFrame: function() {		
		if(this.blinking) {
			if(this.blinking % constants.blinkfactor === 0)
				this.view.toggle();
				
			this.blinking--;
		}
		
		if(this.cooldown)
			this.cooldown--;
		
		if(this.deadly)
			this.deadly--;
		
		if(this.invulnerable)
			this.invulnerable--;
		
		this._super();
	},
	setCoins: function(coins) {
    this.coins = coins;
    this.level.world.parent().children('#coinNumber').text(this.coins);
},
	addLife: function() {
		this.level.playSound('liveupgrade');
		this.setLifes(this.lifes + 1);
	},
	setLifes : function(lifes) {
		this.lifes = lifes;
		this.level.world.parent().children('#liveNumber').text(this.lifes);
	},
	death: function() {
		if(this.deathBeginWait) {
			this.deathBeginWait--;
			return true;
		}
		
		if(this.deathEndWait)
			return --this.deathEndWait;
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			this.deathEndWait = Math.floor(1800 / constants.interval);
			
		return true;
	},
	die: function() {
		this.setMarioState(mario_states.normal);
		this.deathStepDown = Math.ceil(240 / this.deathFrames);
		this.setupFrames(9, 2, false);
		this.setImage(images.sprites, 81, 324);
		this.level.playMusic('die');
		this._super();
	},
	hurt: function(from) {
		if(this.deadly)
			from.die();
		else if(this.invulnerable)
			return;
		else if(this.state === size_states.small) {
			this.die();
		} else {
			this.invulnerable = Math.floor(constants.invulnerable / constants.interval);
			this.blink(Math.ceil(this.invulnerable / (2 * constants.blinkfactor)));
			this.setState(size_states.small);
			this.level.playSound('hurt');			
		}
	},
}, 'mario');

/*
 * -------------------------------------------
 * ENEMY CLASS
 * -------------------------------------------
 */
var Enemy = Figure.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.speed = 0;
	},
	hide: function() {
		this.invisible = true;
		this.view.hide();
	},
	show: function() {	
		this.invisible = false;
		this.view.show();
	},
	move: function() {
		if(!this.invisible) {
			this._super();
		
			if(this.vx === 0) {
				var s = this.speed * Math.sign(this.speed);
				this.setVelocity(this.direction === directions.right ? -s : s, this.vy);
			}
		}
	},
	collides: function(is, ie, js, je, blocking) {
		if(this.j + 1 < this.level.getGridHeight()) {
			for(var i = is; i <= ie; i++) {
				if(i < 0 || i >= this.level.getGridWidth())
					return true;
					
				var obj = this.level.obstacles[i][this.j + 1];
				
				if(!obj || (obj.blocking & ground_blocking.top) !== ground_blocking.top)
					return true;
			}
		}
		
		return this._super(is, ie, js, je, blocking);
	},
	setSpeed: function(v) {
		this.speed = v;
		this.setVelocity(-v, 0);
	},
	hurt: function(from) {
		this.die();
	},
	hit: function(opponent) {
		if(this.invisible)
			return;
			
		if(opponent instanceof Mario) {
			if(opponent.vy < 0 && opponent.y - opponent.vy >= this.y + this.state * 32) {
				opponent.setVelocity(opponent.vx, constants.bounce);
				this.hurt(opponent);
			} else {
				opponent.hurt(this);
			}
		}
	},
});

/*
 * -------------------------------------------
 * GUMPA CLASS
 * -------------------------------------------
 */
var Gumpa = Enemy.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setSize(34, 32);
		this.setSpeed(constants.ballmonster_v);
		this.death_mode = death_modes.normal;
		this.deathCount = 0;
	},
	setVelocity: function(vx, vy) {
		this._super(vx, vy);
		
		if(this.direction === directions.left) {
			if(!this.setupFrames(6, 2, false, 'LeftWalk'))
				this.setImage(images.enemies, 34, 188);
		} else {
			if(!this.setupFrames(6, 2, true, 'RightWalk'))
				this.setImage(images.enemies, 0, 228);
		}
	},
	death: function() {
		if(this.death_mode === death_modes.normal)
			return --this.deathCount;
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + this.deathStep + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			return false;
			
		return true;
	},
	die: function() {
		this.clearFrames();
		
		if(this.death_mode === death_modes.normal) {
			this.level.playSound('enemy_die');
			this.setImage(images.enemies, 102, 228);
			this.deathCount = Math.ceil(600 / constants.interval);
		} else if(this.death_mode === death_modes.shell) {
			this.level.playSound('shell');
			this.setImage(images.enemies, 68, this.direction === directions.right ? 228 : 188);
			this.deathFrames = Math.floor(250 / constants.interval);
			this.deathDir = 1;
			this.deathStep = Math.ceil(150 / this.deathFrames);
		}
		
		this._super();
	},
}, 'ballmonster');

/*
 * -------------------------------------------
 * TURTLESHELL CLASS
 * -------------------------------------------
 */
var TurtleShell = Enemy.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setSize(34, 32);
		this.speed = 0;
		this.setImage(images.enemies, 0, 494);
	},
	activate: function(x, y) {
		this.setupFrames(6, 4, false)
		this.setPosition(x, y);
		this.show();
	},
	takeBack: function(where) {
		if(where.setShell(this))
			this.clearFrames();
	},
	hit: function(opponent) {
		if(this.invisible)
			return;
			
		if(this.vx) {
			if(this.idle)
				this.idle--;
			else if(opponent instanceof Mario)
				opponent.hurt(this);
			else {
				opponent.deathMode = death_modes.shell;
				opponent.die();
			}
		} else {
			if(opponent instanceof Mario) {
				this.setSpeed(opponent.direction === directions.right ? -constants.shell_v : constants.shell_v);
				opponent.setVelocity(opponent.vx, constants.bounce);
				this.idle = 2;
			} else if(opponent instanceof GreenTurtle && opponent.state === size_states.small)
				this.takeBack(opponent);
		}
	},
	collides: function(is, ie, js, je, blocking) {		
		if(is < 0 || ie >= this.level.obstacles.length)
			return true;
			
		if(js < 0 || je >= this.level.getGridHeight())
			return false;
			
		for(var i = is; i <= ie; i++) {
			for(var j = je; j >= js; j--) {
				var obj = this.level.obstacles[i][j];
				
				if(obj && ((obj.blocking & blocking) === blocking))
					return true;
			}
		}
		
		return false;
	},
}, 'shell');

/*
 * -------------------------------------------
 * GREENTURTLE CLASS
 * -------------------------------------------
 */
var GreenTurtle = Enemy.extend({
	init: function(x, y, level) {
		this.walkSprites = [
			[{ x : 34, y : 382 },{ x : 0, y : 437 }],
			[{ x : 34, y : 266 },{ x : 0, y : 325 }]
		];
		this._super(x, y, level);
		this.wait = 0;
		this.deathMode = death_modes.normal;
		this.deathFrames = Math.floor(250 / constants.interval);
		this.deathStepUp = Math.ceil(150 / this.deathFrames);
		this.deathStepDown = Math.ceil(182 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
		this.setSize(34, 54);
		this.setShell(new TurtleShell(x, y, level));
	},
	setShell: function(shell) {
		if(this.shell || this.wait)
			return false;
			
		this.shell = shell;
		shell.hide();
		this.setState(size_states.big);
		return true;
	},
	setState: function(state) {
		this._super(state);
		
		if(state === size_states.big)
			this.setSpeed(constants.big_turtle_v);
		else
			this.setSpeed(constants.small_turtle_v);
	},
	setVelocity: function(vx, vy) {
		this._super(vx, vy);
		var rewind = this.direction === directions.right;
		var coords = this.walkSprites[this.state - 1][rewind ? 1 : 0];
		var label = Math.sign(vx) + '-' + this.state;
		
		if(!this.setupFrames(6, 2, rewind, label))
			this.setImage(images.enemies, coords.x, coords.y);
	},
	die: function() {
		this._super();
		this.clearFrames();
		
		if(this.deathMode === death_modes.normal) {
			this.deathFrames = Math.floor(600 / constants.interval);
			this.setImage(images.enemies, 102, 437);
		} else if(this.deathMode === death_modes.shell) {
			this.level.playSound('shell');
			this.setImage(images.enemies, 68, (this.state === size_states.small ? (this.direction === directions.right ? 437 : 382) : 325));
		}
	},
	death: function() {
		if(this.deathMode === death_modes.normal)
			return --this.deathFrames;
			
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			return false;
			
		return true;
	},
	move: function() {
		if(this.wait)
			this.wait--;
			
		this._super();
	},
	hurt: function(opponent) {	
		this.level.playSound('enemy_die');
		
		if(this.state === size_states.small)
			return this.die();
		
		this.wait = constants.shell_wait
		this.setState(size_states.small);
		this.shell.activate(this.x, this.y);
		this.shell = undefined;
	},
}, 'greenturtle');

/*
 * ------------------------------------------
 * SPIKEDTURTLE CLASS
 * ------------------------------------------
 */
var SpikedTurtle = Enemy.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setSize(34, 32);
		this.setSpeed(constants.spiked_turtle_v);
		this.deathFrames = Math.floor(250 / constants.interval);
		this.deathStepUp = Math.ceil(150 / this.deathFrames);
		this.deathStepDown = Math.ceil(182 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
	},
	setVelocity: function(vx, vy) {
		this._super(vx, vy);
		
		if(this.direction === directions.left) {
			if(!this.setupFrames(4, 2, true, 'LeftWalk'))
				this.setImage(images.enemies, 0, 106);
		} else {
			if(!this.setupFrames(6, 2, false, 'RightWalk'))
				this.setImage(images.enemies, 34, 147);
		}
	},
	death: function() {
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			return false;
			
		return true;
	},
	die: function() {
		this.level.playSound('shell');
		this.clearFrames();
		this._super();
		this.setImage(images.enemies, 68, this.direction === directions.left ? 106 : 147);
	},
	hit: function(opponent) {
		if(this.invisible)
			return;
			
		if(opponent instanceof Mario) {
			opponent.hurt(this);
		}
	},
}, 'spikedturtle');

/*
 * -------------------------------------------
 * PLANT CLASS
 * -------------------------------------------
 */
var Plant = Enemy.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.setSize(34, 42);
		this.setupFrames(5, 2, true);
		this.setImage(images.enemies, 0, 3);
	},
	setVelocity: function(vx, vy) {
		this._super(0, 0);
	},
	die: function() {
		this.level.playSound('shell');
		this.clearFrames();
		this._super();
	},
	hit: function(opponent) {
		if(this.invisible)
			return;
			
		if(opponent instanceof Mario) {
			opponent.hurt(this);
		}
	},
});

/*
 * ------------------------------------------
 * STATICPLANT CLASS
 * ------------------------------------------
 */
var StaticPlant = Plant.extend({
	init: function(x, y, level) {
		this._super(x, y, level);
		this.deathFrames = Math.floor(250 / constants.interval);
		this.deathStepUp = Math.ceil(100 / this.deathFrames);
		this.deathStepDown = Math.ceil(132 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
	},
	die: function() {
		this._super();
		this.setImage(images.enemies, 68, 3);
	},
	death: function() {
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			return false;
			
		return true;
	},
}, 'staticplant');

/*
 * -------------------------------------------
 * PIPEPLANT CLASS
 * -------------------------------------------
 */
var PipePlant = Plant.extend({
	init: function(x, y, level) {
		this.bottom = y - 48;
		this.top = y - 6;
		this._super(x + 16, y - 6, level);
		this.setDirection(directions.down);
		this.setImage(images.enemies, 0, 56);
		this.deathFrames = Math.floor(250 / constants.interval);
		this.deathFramesExtended = 6;
		this.deathFramesExtendedActive = false;
		this.deathStep = Math.ceil(100 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
		this.view.css('z-index', 95);
	},
	setDirection: function(dir) {
		this.direction = dir;
	},
	setPosition: function(x, y) {
		if(y === this.bottom || y === this.top) {
			this.minimum = constants.pipeplant_count;
			this.setDirection(this.direction === directions.up ? directions.down : directions.up);
		}
		
		this._super(x, y);
	},
	blocked: function() {
		if(this.y === this.bottom) {
			var state = false;
			this.y += 48;
			
			for(var i = this.level.figures.length; i--; ) {
				if(this.level.figures[i] != this && q2q(this.level.figures[i], this)) {
					state = true;
					break;
				}
			}
			
			this.y -= 48;
			return state;
		}
		
		return false;
	},
	move: function() {
		if(this.minimum === 0) {
			if(!this.blocked())
				this.setPosition(this.x, this.y - (this.direction - 3) * constants.pipeplant_v);
		} else
			this.minimum--;
	},
	die: function() {		
		this._super();
		this.setImage(images.enemies, 68, 56);
	},
	death: function() {
		if(this.deathFramesExtendedActive) {
			this.setPosition(this.x, this.y - 8);
			return --this.deathFramesExtended;
		}
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + this.deathStep + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			this.deathFramesExtendedActive = true;
			
		return true;
	},
}, 'pipeplant');


// ===== MUSIK CONTROL =====
var musicEnabled = true;
var YT_BASE_SRC = 'https://www.youtube.com/embed/SB1VqLCTFpA?rel=0&autoplay=1';

function setMusic(status) {
    musicEnabled = status;
    var iframe = document.getElementById('bgMusic');
    if (status) {
        iframe.src = YT_BASE_SRC + '&mute=0';
        document.getElementById('musicStatus').textContent = 'Musik: ON';
        document.getElementById('musicStatus').style.color = '#27ae60';
        document.getElementById('musicOnBtn').style.opacity = '1';
        document.getElementById('musicOffBtn').style.opacity = '0.5';
    } else {
        iframe.src = YT_BASE_SRC + '&mute=1';
        document.getElementById('musicStatus').textContent = 'Musik: OFF';
        document.getElementById('musicStatus').style.color = '#e74c3c';
        document.getElementById('musicOnBtn').style.opacity = '0.5';
        document.getElementById('musicOffBtn').style.opacity = '1';
    }
}
// ===== END MUSIK CONTROL =====

	var soalList = [];
	var soalIndex = 0;
	var materiList = [];
	var materiIndex = 0;
	var currentPlayer = null;
	var currentLevels = [];
	var gameMode = 'percabangan';
	var level = null;
	var activeTopikMateri = 'percabangan';

//LEVEL COMPLETE POP UP//
function showLevelComplete(coins, levelId) {
    window._levelCompleteShowing = true;
    if (level) level.pause();
    keys.unbind();

    var topikNama = gameMode === 'percabangan' ? 'Percabangan' : 'Perulangan';
    var isLastLevel = (levelId === currentLevels[currentLevels.length - 1].id);
    var btnText = isLastLevel ? 'Menu Utama' : 'Next ▶';
    var judul = isLastLevel
        ? 'Yeay!!<br>Kamu telah menyelesaikan<br>Materi ' + topikNama
        : 'Level Selesai!<br>Siap ke level berikutnya?';

    $('#levelCompleteOverlay').remove();
    var html = '<div id="levelCompleteOverlay" style="position:absolute;top:0;left:0;width:640px;height:480px;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#fff;border-radius:16px;border:3px solid #e8c0c0;padding:32px 36px;width:400px;display:flex;flex-direction:column;align-items:center;gap:16px;box-sizing:border-box;">' +
        '<div style="font-size:0.9em;color:#c8860a;text-align:center;font-weight:bold;font-family:PS2P,sans-serif;line-height:1.8;">' + judul + '</div>' +
        '<div style="font-size:1.4em;">🪙</div>' +
        '<div style="font-size:0.8em;color:#333;font-family:PS2P,sans-serif;">Coin Akhir = ' + coins + '</div>' +
        '<button id="levelCompleteBtn" style="background:#d0a0a0;color:#333;border:none;border-radius:30px;padding:12px 36px;font-family:PS2P,sans-serif;font-size:0.65em;cursor:pointer;box-shadow:0 4px 0 #a07070;margin-top:8px;">' + btnText + '</button>' +
        '</div></div>';

    $('#game').append(html);

    $('#levelCompleteBtn').on('click', function() {
        $('#levelCompleteOverlay').remove();

        // Cari index level ini di currentLevels (dinamis, tidak hardcode)
        var currentLevelIndex = -1;
        for (var ci = 0; ci < currentLevels.length; ci++) {
            if (currentLevels[ci].id === levelId) { currentLevelIndex = ci; break; }
        }
        // Mid level = bukan terakhir, index genap (pola: materi→soal→materi→soal)
        var isMidLevel   = !isLastLevel && (currentLevelIndex % 2 === 0);
        var isFinalLevel = isLastLevel;

        // Simpan state Mario sebelum apapun
        var savedSettings = { lifes: 0, coins: 0, state: size_states.small, marioState: mario_states.normal };
        if (level && level.figures) {
            for (var i = level.figures.length; i--;) {
                if (level.figures[i] instanceof Mario) {
                    savedSettings.lifes      = level.figures[i].lifes;
                    savedSettings.coins      = level.figures[i].coins;
                    savedSettings.state      = level.figures[i].state;
                    savedSettings.marioState = level.figures[i].marioState;
                    break;
                }
            }
        }

        function doNextLevel() {
            window._levelCompleteShowing = false;
            var nextLevel = null;
            for (var i = 0; i < currentLevels.length; i++) {
                if (currentLevels[i].id === levelId + 1) { nextLevel = currentLevels[i]; break; }
            }
            if (!nextLevel) return;
            level.load(nextLevel);
            for (var k = level.figures.length; k--;) {
                if (level.figures[k] instanceof Mario) {
                    level.figures[k].setLifes(savedSettings.lifes || 0);
                    level.figures[k].setCoins(savedSettings.coins || 0);
                    level.figures[k].setState(savedSettings.state || size_states.small);
                    level.figures[k].setMarioState(savedSettings.marioState || mario_states.normal);
                    level.figures[k]._victoryDone = false;
                    break;
                }
            }
            level.start();
            keys.reset();
            keys.bind();
        }

        // Leaderboard sementara setelah level materi
        if (isMidLevel) {
            if (level) level.pause();
            keys.unbind();
            if (currentPlayer) {
                fetch('api/simpan_nilai.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        siswa_id: currentPlayer.id, topik: gameMode,
                        skor: skorMateri, total_soal: 0, benar: 0,
                        skor_materi: skorMateri, skor_soal: 0,
                        skor_compiler: 0, koin: savedSettings.coins
                    })
                });
            }
            showLeaderboardPopup('sementara', function() {
                doNextLevel();
            });
            return;
        }

        // Leaderboard final di akhir topik
        if (isFinalLevel) {
            if (currentPlayer) {
                fetch('api/simpan_nilai.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        siswa_id: currentPlayer.id, topik: gameMode,
                        skor: skorMateri + skorSoal + skorCompiler,
                        total_soal: currentPlayer.total_soal || 0,
                        benar: currentPlayer.benar || 0,
                        skor_materi: skorMateri, skor_soal: skorSoal,
                        skor_compiler: skorCompiler, koin: savedSettings.coins
                    })
                });
            }
            showLeaderboardPopup('final', function() {
                window._levelCompleteShowing = false;
                stopRankingSidebar();
                level.reset(); keys.reset();
                $('#gameWrapper').hide();
                $('#startScreen').css('display', 'flex');
            });
            return;
        }

        // Level biasa — lanjut langsung tanpa leaderboard
        doNextLevel();
    });
}
//LEVEL COMPLETE POP UP//

$(document).ready(function() {
	var currentGuru = null;
	skorMateri = 0; skorSoal = 0; skorCompiler = 0;
	currentLevels = branchLevels;
	gameMode = 'percabangan';
	level = new Level('world');

    // Panduan guru
$('#btnPanduanGuru').on('click', function() {
    $('#modalPanduan').scrollTop(0);
    $('#modalPanduan > div').scrollTop(0);
    $('#modalPanduan').css('display', 'flex');
});
$(document).on('click', '#btnTutupPanduan', function() {
    $('#modalPanduan').hide();
});
$(document).on('click', '#modalPanduan', function(e) {
    if ($(e.target).is('#modalPanduan')) $('#modalPanduan').hide();
});

	// don't start game until player clicks start button
$('#startButton').click(function() {
    $('#startScreen').hide();
    $('#roleScreen').css('display', 'flex');
});

// ===== TOMBOL KEMBALI =====
$('#btnKembaliRole').click(function() {
    $('#roleScreen').hide();
    $('#startScreen').css('display', 'flex');
});

$('#btnKembaliSelection').click(function() {
    $('#selectionScreen').hide();
    $('#roleScreen').css('display', 'flex');
});

$('#btnKembaliLogin').click(function() {
    $('#nameInputScreen').hide();
    $('#selectionScreen').css('display', 'flex');
    $('#playerUsernameInput').val('');
    $('#playerPasswordInput').val('');
    $('#nameInputError').hide();
    $('#nameSubmitBtn').text('Masuk').prop('disabled', false);
});

$('#btnKembaliGuru').click(function() {
    $('#guruLoginScreen').hide();
    $('#roleScreen').css('display', 'flex');
    $('#guruUsernameInput').val('');
    $('#guruPasswordInput').val('');
    $('#guruLoginError').hide();
    $('#guruLoginBtn').text('Masuk').prop('disabled', false);
});
// ===== END TOMBOL KEMBALI =====

// Pilih peran
$('#btnSiswa').click(function() {
    $('#roleScreen').hide();
    $('#selectionScreen').css('display', 'flex');
});

$('#btnGuru').click(function() {
    $('#roleScreen').hide();
    $('#guruLoginScreen').css('display', 'flex');
    $('#guruUsernameInput').val('').focus();
    $('#guruPasswordInput').val('');
    $('#guruLoginError').hide();
});

// Login guru
$('#guruLoginBtn').click(function() {
    doGuruLogin();
});
$('#guruUsernameInput, #guruPasswordInput').on('keydown', function(e) {
    if (e.key === 'Enter') doGuruLogin();
});

function doGuruLogin() {
    var username = $('#guruUsernameInput').val().trim();
    var password = $('#guruPasswordInput').val().trim();

    if (username === '' || password === '') {
        $('#guruLoginError').text('Username dan password wajib diisi!').show();
        return;
    }

    $('#guruLoginBtn').text('Loading...').prop('disabled', true);

    fetch('api/login_guru.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            currentGuru = { id: data.guru_id, nama: data.nama };
            $('#guruLoginScreen').hide();
            $('#guruWelcome').text('Halo, ' + data.nama);
            $('#guruDashboard').css('display', 'flex');
            loadSoal();
            $('#guruLoginBtn').text('Masuk').prop('disabled', false);
        } else {
            $('#guruLoginError').text(data.message).show();
            $('#guruLoginBtn').text('Masuk').prop('disabled', false);
        }
    })
    .catch(function() {
        $('#guruLoginError').text('Gagal terhubung ke server!').show();
        $('#guruLoginBtn').text('Masuk').prop('disabled', false);
    });
}

// Logout guru
$('#guruLogoutBtn').click(function() {
    currentGuru = null;
    $('#guruDashboard').hide();
    $('#startScreen').css('display', 'flex');
});

// Menu guru
$('.guru-menu-btn').click(function() {
    $('.guru-menu-btn').removeClass('active');
    $(this).addClass('active');
    $('.guru-panel').hide();
    $('#' + $(this).data('panel')).show();

    var panel = $(this).data('panel');
    if (panel === 'panel-soal') loadSoal();
    if (panel === 'panel-materi') loadMateri();
    if (panel === 'panel-siswa') loadSiswa();
    if (panel === 'panel-nilai') loadNilai();
	if (panel === 'panel-compiler') loadCompilerSoal();
});

// ===== KELOLA MATERI =====
var currentEditMateriId = null;

window.switchTopikMateri = function(topik) {
    activeTopikMateri = topik;
    $('.materi-topik-btn').removeClass('active');
    $('.materi-topik-btn[data-topik="' + topik + '"]').addClass('active');
    $('#formMateri').hide();
    currentEditMateriId = null;
    loadMateri();
};

function loadMateri() {
    fetch('api/get_materi.php?topik=' + activeTopikMateri)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var html = '<table class="guru-table"><tr><th>No</th><th>Judul</th><th>Aksi</th></tr>';
        data.forEach(function(m) {
            html += '<tr><td>' + m.slot + '</td><td>' + m.judul + '</td>';
            html += '<td><button class="btn-edit" onclick="editMateriSlot(' + m.slot + ', \'' + m.topik + '\')">Edit</button></td></tr>';
        });
        html += '</table>';
        $('#materiSlotList').html(html);
    });
}

window.editMateriSlot = function(slot, topik) {
    fetch('api/get_materi.php?topik=' + topik + '&slot=' + slot)
    .then(function(res) { return res.json(); })
    .then(function(m) {
        $('#formMateri').show();
        $('#materiSlot').val(slot);
        $('#materiTopikHidden').val(topik);
        currentEditMateriId = m ? m.id : null;
        $('#formMateriJudul').text('Edit Materi ' + slot + ' — ' + topik.charAt(0).toUpperCase() + topik.slice(1));
        $('#materiJudul').val(m ? m.judul : '');
        $('#materiIsi').val(m ? m.isi : '');
        $('#materiVideoUrl').val(m ? (m.video_url || '') : '');
		$('#materiGambarFilename').val(m ? (m.gambar || '') : '');
		if (m && m.gambar) {
			$('#materiGambarPreview').html('<img src="uploads/materi/' + m.gambar + '" style="max-width:100%;max-height:120px;border-radius:6px;margin-top:4px;">');
		} else {
			$('#materiGambarPreview').html('');
		}
    });
};

$('#btnBatalMateri').click(function() {
    $('#formMateri').hide();
    currentEditMateriId = null;
});

$('#btnSimpanMateri').click(function() {
    var fileInput = document.getElementById('materiGambar');
    var file = fileInput.files[0];

    function simpanDenganGambar(filename) {
        var materiData = {
            id:        currentEditMateriId || '',
            topik:     $('#materiTopikHidden').val(),
            slot:      parseInt($('#materiSlot').val()),
            judul:     $('#materiJudul').val(),
            isi:       $('#materiIsi').val(),
            video_url: $('#materiVideoUrl').val().trim(),
            gambar:    filename || $('#materiGambarFilename').val() || ''
        };
        fetch('api/simpan_materi.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materiData)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) { $('#formMateri').hide(); currentEditMateriId = null; loadMateri(); }
            else alert('Gagal simpan: ' + data.message);
        });
    }

    if (file) {
        var formData = new FormData();
        formData.append('gambar', file);
        fetch('api/upload_gambar_materi.php', {
            method: 'POST',
            body: formData
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) simpanDenganGambar(data.filename);
            else alert('Gagal upload gambar: ' + data.message);
        });
    } else {
        simpanDenganGambar(null);
    }
});
// ===== END KELOLA MATERI =====

// ===== KELOLA SOAL =====
var activeSoalTopik = 'percabangan';
var currentEditSoalId = null; // ← simpan id di variabel JS, bukan .data()

window.switchTopikSoal = function(topik) {
    activeSoalTopik = topik;
    $('.soal-topik-btn').removeClass('active');
    $('.soal-topik-btn[data-topik="' + topik + '"]').addClass('active');
    $('#formSoal').hide();
    currentEditSoalId = null;
    loadSoal();
};

function loadSoal() {
    fetch('api/get_soal.php?topik=' + activeSoalTopik)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var html = '<table class="guru-table">' +
            '<tr><th>No</th><th>Pertanyaan</th><th>Aksi</th></tr>';
        data.forEach(function(s) {
            var preview = s.pertanyaan ? s.pertanyaan : '(belum diisi)';
            html += '<tr><td>' + s.slot + '</td><td>' + preview + '</td>';
            html += '<td><button class="btn-edit" onclick="editSoal(' + s.id + ')">Edit</button></td></tr>';
        });
        html += '</table>';
        $('#soalList').html(html);
    });
}

window.editSoal = function(id) {
    fetch('api/get_soal.php?id=' + id)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var s = Array.isArray(data) ? data[0] : data;
        if (!s) return;
        currentEditSoalId = s.id;
        $('#formSoal').show();
        $('#soalSlot').val(s.slot);
        $('#soalTopikHidden').val(s.topik);
        $('#soalPertanyaan').val(s.pertanyaan);
        $('#soalA').val(s.pilihan_a);
        $('#soalB').val(s.pilihan_b);
        $('#soalC').val(s.pilihan_c);
        $('#soalD').val(s.pilihan_d);
        $('#soalE').val(s.pilihan_e || '');
        $('#soalJawaban').val(s.jawaban);
        $('#soalPembahasan').val(s.pembahasan || '');
        $('#formSoalJudul').text('Edit Soal ' + s.slot + ' — ' + s.topik.charAt(0).toUpperCase() + s.topik.slice(1));

        // ← TAMBAHAN: load gambar yang sudah ada ke hidden input + preview
        var huruf = ['a','b','c','d','e'];
        huruf.forEach(function(h) {
            var filename = s['gambar_' + h] || '';
            $('#gambarSoal' + h.toUpperCase() + 'Filename').val(filename);
            var $preview = $('#previewGambar' + h.toUpperCase());
            if (filename) {
                $preview.html('<img src="uploads/soal/' + filename + '" style="max-height:60px;border-radius:4px;margin-top:2px;">');
            } else {
                $preview.html('');
            }
        });

        // Reset file input supaya tidak ada sisa pilihan sebelumnya
        $('#gambarSoalA, #gambarSoalB, #gambarSoalC, #gambarSoalD, #gambarSoalE').val('');
    });
};

$('#btnBatalSoal').click(function() {
    $('#formSoal').hide();
    currentEditSoalId = null;
});

$('#btnSimpanSoal').click(function() {
    if (!currentEditSoalId) {
        alert('ID soal tidak ditemukan!');
        return;
    }

    var huruf = ['a','b','c','d','e'];
    var uploadPromises = huruf.map(function(h) {
        var file = document.getElementById('gambarSoal' + h.toUpperCase()).files[0];
        if (!file) return Promise.resolve(null); // tidak ada file baru → kirim null (pertahankan lama)
        var formData = new FormData();
        formData.append('gambar', file);
        return fetch('api/upload_gambar_soal.php', { method: 'POST', body: formData })
            .then(function(res) { return res.json(); })
            .then(function(data) { return data.success ? data.filename : null; });
    });

    Promise.all(uploadPromises).then(function(filenames) {
        var topikSoal = $('#soalTopikHidden').val();
        var soalData = {
            id:         currentEditSoalId,
            topik:      topikSoal,
            slot:       parseInt($('#soalSlot').val()),
            pertanyaan: $('#soalPertanyaan').val(),
            pilihan_a:  $('#soalA').val(),
            pilihan_b:  $('#soalB').val(),
            pilihan_c:  $('#soalC').val(),
            pilihan_d:  $('#soalD').val(),
            pilihan_e:  $('#soalE').val(),
            jawaban:    $('#soalJawaban').val(),
            pembahasan: $('#soalPembahasan').val()
        };

        // Kalau ada file baru → pakai filename baru
        // Kalau tidak ada file baru → kirim '' supaya simpan_soal.php skip update kolom itu
        huruf.forEach(function(h, i) {
            soalData['gambar_' + h] = filenames[i] !== null
                ? filenames[i]
                : ''; // '' = tidak ada file baru, simpan_soal.php akan skip kolom ini
        });

        fetch('api/simpan_soal.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(soalData)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                $('#formSoal').hide();
                currentEditSoalId = null;
                activeSoalTopik = topikSoal;
                loadSoal();
            } else {
                alert('Gagal simpan: ' + (data.message || ''));
            }
        })
        .catch(function() {
            alert('Gagal terhubung ke server!');
        });
    });
});
// ===== END KELOLA SOAL =====

// ===== KELOLA COMPILER =====
var activeTopikCompiler = 'percabangan';

var subtopikLabel = {
    'if_then_tunggal'      : 'If..Then (kondisi & pernyataan tunggal)',
    'if_then_jamak'        : 'If..Then (pernyataan jamak)',
    'if_then_2kondisi'     : 'If..Then (2 kondisi)',
    'if_then_kondisi_jamak': 'If..Then (kondisi jamak)',
    'select_case'          : 'Select Case',
    'for_next'             : 'For..Next',
    'do_loop_while'        : 'Do..Loop While',
    'do_loop_until'        : 'Do..Loop Until',
};

var subtopikPerTopik = {
    percabangan: [
        { val: 'if_then_tunggal',       label: subtopikLabel['if_then_tunggal'] },
        { val: 'if_then_jamak',         label: subtopikLabel['if_then_jamak'] },
        { val: 'if_then_2kondisi',      label: subtopikLabel['if_then_2kondisi'] },
        { val: 'if_then_kondisi_jamak', label: subtopikLabel['if_then_kondisi_jamak'] },
        { val: 'select_case',           label: subtopikLabel['select_case'] },
    ],
    perulangan: [
        { val: 'for_next',      label: subtopikLabel['for_next'] },
        { val: 'do_loop_while', label: subtopikLabel['do_loop_while'] },
        { val: 'do_loop_until', label: subtopikLabel['do_loop_until'] },
    ]
};

window.switchTopikCompiler = function(topik) {
    activeTopikCompiler = topik;
    $('.soal-topik-btn').removeClass('active');
    $('.soal-topik-btn[data-topik="' + topik + '"]').addClass('active');
    $('#formCompiler').hide();
    loadCompilerSoal();
};

function loadCompilerSoal() {
    var list = subtopikPerTopik[activeTopikCompiler] || [];
    $('#compilerSoalList').html('<p style="color:#aaa;font-family:PS2P,sans-serif;font-size:0.7em;">Memuat...</p>');

    fetch('api/get_soal_compiler.php?topik=' + encodeURIComponent(activeTopikCompiler))
    .then(function(res) { return res.json(); })
    .then(function(rows) {
        var dbMap = {};
        (rows || []).forEach(function(r) { dbMap[r.subtopik] = r; });

        var html = '<table class="guru-table"><tr><th>No</th><th>Subtopik</th><th>Judul</th><th>Status</th><th>Aksi</th></tr>';
        list.forEach(function(sub, idx) {
            var soal  = dbMap[sub.val] || {};
            var dbid  = soal.id || 0;
            var aktif = soal.is_active == 1
                ? '<span style="color:#27ae60;font-family:PS2P,sans-serif;font-size:0.8em;">✅ Aktif</span>'
                : '<span style="color:#aaa;font-family:PS2P,sans-serif;font-size:0.8em;">—</span>';
            html += '<tr>';
            html += '<td>' + (idx + 1) + '</td>';
            html += '<td>' + sub.label + '</td>';
            html += '<td>' + (soal.judul || '<em style="color:#aaa">Belum diisi</em>') + '</td>';
            html += '<td>' + aktif + '</td>';
            html += '<td><button class="btn-edit" onclick="editCompilerSoal(\'' + activeTopikCompiler + '__' + sub.val + '\',' + dbid + ')">Edit</button></td>';
            html += '</tr>';
        });
        html += '</table>';
        $('#compilerSoalList').html(html);
    })
    .catch(function() {
        $('#compilerSoalList').html('<p style="color:red">Gagal memuat data dari server.</p>');
    });
}

window.editCompilerSoal = function(key, dbid) {
    var parts    = key.split('__');
    var topik    = parts[0];
    var subtopik = parts[1];
    var subList  = subtopikPerTopik[topik] || [];
    var subItem  = subList.find(function(s){ return s.val === subtopik; }) || {};

    $('#compilerSoalId').val(key).data('dbid', dbid || 0);
    $('#compilerTopik').val(topik);
    $('#compilerSubtopikVal').val(subtopik);
    $('#compilerJudul').val('');
    $('#compilerInstruksi').val('');
    $('#compilerKodeJawaban').val('');
    $('#compilerPembahasan').val('');
    $('#compilerWaktu').val(600);
    $('#compilerIsActive').prop('checked', false);
    $('#formCompilerJudul').text('Edit — ' + (subItem.label || subtopik));

    if (dbid) {
        fetch('api/get_soal_compiler.php?id=' + dbid)
        .then(function(res) { return res.json(); })
        .then(function(soal) {
            if (!soal) return;
            $('#compilerJudul').val(soal.judul || '');
            $('#compilerInstruksi').val(soal.instruksi || '');
            $('#compilerKodeJawaban').val(soal.kode_jawaban || '');
            $('#compilerPembahasan').val(soal.pembahasan || '');
            $('#compilerWaktu').val(soal.waktu || 600);
            $('#compilerIsActive').prop('checked', soal.is_active == 1);
        });
    }

    $('#formCompiler').show();
    $('#formCompiler')[0].scrollIntoView({ behavior: 'smooth' });
};

$('#btnSimpanCompiler').click(function() {
    var key  = $('#compilerSoalId').val();
    var dbid = $('#compilerSoalId').data('dbid') || 0;
    if (!key) return;

    var parts   = key.split('__');
    var payload = {
        id:           dbid || null,
        topik:        parts[0],
        subtopik:     parts[1],
        judul:        $('#compilerJudul').val().trim(),
        instruksi:    $('#compilerInstruksi').val().trim(),
        kode_jawaban: $('#compilerKodeJawaban').val(),
        pembahasan:   $('#compilerPembahasan').val().trim(),
        waktu:        parseInt($('#compilerWaktu').val()) || 600,
        is_active:    $('#compilerIsActive').is(':checked') ? 1 : 0,
        testcases:    []
    };

    fetch('api/simpan_soal_compiler.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            $('#compilerSoalId').data('dbid', data.id);
            $('#formCompiler').hide();
            loadCompilerSoal();
            alert('Soal compiler disimpan!');
        } else {
            alert('Gagal simpan: ' + (data.msg || 'Error'));
        }
    })
    .catch(function() {
        alert('Gagal terhubung ke server!');
    });
});

$('#btnBatalCompiler').click(function() {
    $('#formCompiler').hide();
});
// ===== END KELOLA COMPILER =====

// ===== KELOLA SISWA =====
var currentEditSiswaId = null;

function loadSiswa() {
    fetch('api/get_siswa.php')
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var html = '<table class="guru-table"><tr><th>No</th><th>Nama</th><th>Username</th><th>Aksi</th></tr>';
        data.forEach(function(s, index) {
            html += '<tr>';
            html += '<td>' + (index + 1) + '</td>';
            html += '<td>' + s.nama + '</td>';
            html += '<td>' + s.username + '</td>';
            html += '<td>';
            html += '<button class="btn-edit" onclick="editSiswa(' + s.id + ')">Edit</button> ';
            html += '<button class="btn-hapus" onclick="hapusSiswa(' + s.id + ')">Hapus</button>';
            html += '</td></tr>';
        });
        html += '</table>';
        $('#siswaList').html(html);
    });
}

window.editSiswa = function(id) {
    fetch('api/get_siswa.php?id=' + id)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var s = Array.isArray(data) ? data[0] : data;
        if (!s) return;
        currentEditSiswaId = s.id;
        $('#formSiswaJudul').text('Edit Siswa');
        $('#siswaNama').val(s.nama);
        $('#siswaUsername').val(s.username);
        $('#siswaPassword').val('');
        $('#siswaPasswordNote').show();
        $('#formSiswa').show();
    });
};

$('#btnTambahSiswa').click(function() {
    currentEditSiswaId = null;
    $('#formSiswaJudul').text('Tambah Siswa');
    $('#siswaNama, #siswaUsername, #siswaPassword').val('');
    $('#siswaPasswordNote').hide();
    $('#formSiswa').show();
});

$('#btnBatalSiswa').click(function() {
    $('#formSiswa').hide();
    currentEditSiswaId = null;
});

$('#btnSimpanSiswa').click(function() {
    var payload = {
        nama:     $('#siswaNama').val(),
        username: $('#siswaUsername').val(),
        password: $('#siswaPassword').val()
    };

    if (currentEditSiswaId) {
        payload.id = currentEditSiswaId;
        fetch('api/edit_siswa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) { $('#formSiswa').hide(); currentEditSiswaId = null; loadSiswa(); }
            else alert('Gagal: ' + (data.message || ''));
        });
    } else {
        fetch('api/tambah_siswa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) { $('#formSiswa').hide(); loadSiswa(); }
            else alert('Gagal: ' + (data.message || ''));
        });
    }
});

window.hapusSiswa = function(id) {
    if (confirm('Hapus siswa ini?')) {
        fetch('api/hapus_siswa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) { if (data.success) loadSiswa(); });
    }
};
// ===== END KELOLA SISWA =====

/// ===== DATA NILAI =====
var activeTopikNilai = 'percabangan';

window.switchTopikNilai = function(topik) {
    activeTopikNilai = topik;
    $('.soal-topik-btn[data-topik]').removeClass('active');
    $('.soal-topik-btn[data-topik="' + topik + '"]').addClass('active');
    loadNilai();
};

window.loadNilai = function() {
    $('#nilaiHeader').show();
    fetch('api/get_nilai.php?topik=' + activeTopikNilai)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var html = '<table class="guru-table">' +
            '<tr>' +
            '<th>Nama</th>' +
            '<th>Skor Total</th>' +
            '<th>Materi (max 30)</th>' +
            '<th>Soal (max 35)</th>' +
            '<th>Compiler (max 35)</th>' +
            '<th>Koin</th>' +
            '<th>Tanggal</th>' +
            '<th>Rincian</th>' +
            '</tr>';
        data.forEach(function(n) {
            html += '<tr>';
            html += '<td>' + n.nama + '</td>';
            html += '<td><b>' + (n.skor || 0) + '</b></td>';
            html += '<td>' + (n.skor_materi || 0) + '</td>';
            html += '<td>' + (n.skor_soal || 0) + '</td>';
            html += '<td>' + (n.skor_compiler || 0) + '</td>';
            html += '<td>🪙 ' + (n.koin || 0) + '</td>';
            html += '<td>' + n.played_at + '</td>';
            html += '<td><button class="btn-edit" onclick="lihatRincianNilai(' + n.siswa_id + ', \'' + n.nama + '\', \'' + activeTopikNilai + '\')">Lihat</button></td>';
            html += '</tr>';
        });
        html += '</table>';
        html += '<div style="margin-top:12px;text-align:right;">' +
        '<button onclick="printSemuaNilai()" style="background:#e74c3c;color:#fff;border:2px solid #e74c3c;border-radius:20px;padding:8px 18px;font-family:PS2P,sans-serif;font-size:0.55em;cursor:pointer;">🖨️ Print Semua</button>' +
        '</div>';
$('#nilaiList').html(html);
    });
}

// ===== END DATA NILAI =====

window.lihatRincianNilai = function(siswa_id, nama, topik) {
    Promise.all([
        fetch('api/get_nilai.php?topik=' + topik + '&siswa_id=' + siswa_id)
            .then(function(r){ return r.text(); })
            .then(function(t){ try { return JSON.parse(t); } catch(e){ return []; } }),
        fetch('api/get_progress.php?siswa_id=' + siswa_id)
            .then(function(r){ return r.text(); })
            .then(function(t){ try { return JSON.parse(t); } catch(e){ return []; } })
    ]).then(function(results) {
		$('#nilaiHeader').hide();
        var nilai   = results[0][0] || {};
        var progAll = results[1]   || [];
        var prog    = progAll.filter(function(p){ return p.topik === topik; });

        var materiProg   = prog.filter(function(p){ return p.jenis === 'materi'; });
        var soalProg     = prog.filter(function(p){ return p.jenis === 'soal'; });
        var compilerProg = prog.filter(function(p){ return p.jenis === 'compiler'; });

        // Jumlah materi maksimal per topik
        var maxMateri = topik === 'percabangan' ? 6 : 5;
        var maxSoal   = 7;

        // Set slot materi yang sudah dibaca
        var materiDone = {};
		materiProg.forEach(function(p){ if (p.slot) materiDone[parseInt(p.slot)] = p.selesai_at; });

        // Set slot soal yang sudah dikerjakan
        var soalDone = {};
		soalProg.forEach(function(p){ if (p.slot) soalDone[parseInt(p.slot)] = p; });

        var html = '';

// Tombol kembali
html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<button onclick="loadNilai();" style="font-family:PS2P,sans-serif;font-size:0.6em;background:#444;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">&#8592; Kembali</button>' +
        '<button onclick="printRincianNilai(\'' + nama + '\',\'' + topik + '\')" style="background:#e74c3c;color:#fff;border:2px solid #e74c3c;border-radius:20px;padding:6px 16px;font-family:PS2P,sans-serif;font-size:0.55em;cursor:pointer;">🖨️ Print PDF</button>' +
        '</div>';
// Header
html += '<div style="font-family:PS2P,sans-serif;font-size:0.6em;margin-bottom:12px;color:#f0c040;">' +
        '&#x1F4CB; Rincian Nilai &mdash; ' + nama + ' (' + topik + ')</div>';

// Kartu skor — 1 baris
html += '<div style="display:flex;gap:8px;margin-bottom:16px;justify-content:flex-start;">';
var kartu = [
    { label: 'TOTAL', val: (nilai.skor || 0),                    warna: '#f0c040' },
    { label: 'MATERI', val: (nilai.skor_materi || 0) + '/30',    warna: '#3498db' },
    { label: 'SOAL',   val: (nilai.skor_soal || 0) + '/35',      warna: '#2ecc71' },
    { label: 'COMPILER', val: (nilai.skor_compiler || 0) + '/35',warna: '#e74c3c' },
    { label: 'KOIN',   val: (nilai.koin || 0),                   warna: '#f39c12' },
];
kartu.forEach(function(k) {
    html += '<div style="background:#1a1a2e;border:1px solid #555;border-radius:8px;' +
            'padding:8px 12px;text-align:center;flex:1;">' +
            '<div style="font-family:PS2P,sans-serif;font-size:0.42em;color:#999;margin-bottom:4px;">' + k.label + '</div>' +
            '<div style="font-family:PS2P,sans-serif;font-size:0.68em;color:' + k.warna + ';">' + k.val + '</div>' +
            '</div>';
});
html += '</div>';

// Tabel helper
function buatTabel(headers, rows) {
    var t = '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-family:PS2P,sans-serif;font-size:0.55em;">';
    t += '<tr>';
    headers.forEach(function(h) {
        t += '<th style="background:#2c3e50;color:#fff;padding:8px 12px;text-align:left;border-bottom:2px solid #444;">' + h + '</th>';
    });
    t += '</tr>';
    rows.forEach(function(r, i) {
        var bg = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
        t += '<tr style="background:' + bg + ';">';
        r.forEach(function(cell) {
            t += '<td style="padding:7px 12px;border-bottom:1px solid #ddd;color:#222;">' + cell + '</td>';
        });
        t += '</tr>';
    });
    t += '</table>';
    return t;
}

// === MATERI ===
html += '<div style="font-family:PS2P,sans-serif;font-size:0.58em;color:#3498db;margin-bottom:8px;">&#x1F4D6; Materi</div>';
var materiRows = [];
for (var m = 1; m <= maxMateri; m++) {
    if (materiDone[m]) {
        materiRows.push(['Materi ' + m, '<span style="color:#2ecc71;">&#x2705; Sudah Dibaca</span>']);
    } else {
        materiRows.push(['Materi ' + m, '<span style="color:#777;">&mdash; Belum Dibaca</span>']);
    }
}
html += buatTabel(['Slot', 'Status'], materiRows);

// === SOAL ===
html += '<div style="font-family:PS2P,sans-serif;font-size:0.58em;color:#2ecc71;margin-bottom:8px;">&#x1F4DD; Soal</div>';
var soalRows = [];
for (var s2 = 1; s2 <= maxSoal; s2++) {
    if (soalDone[s2]) {
        var wSoal  = soalDone[s2].status === 'benar' ? '#2ecc71' : '#e74c3c';
        var lSoal  = soalDone[s2].status === 'benar' ? '&#x2705; Benar' : '&#x274C; Salah';
        soalRows.push(['Soal ' + s2, '<span style="color:' + wSoal + ';">' + lSoal + '</span>']);
    } else {
        soalRows.push(['Soal ' + s2, '<span style="color:#777;">&mdash; Belum Dikerjakan</span>']);
    }
}
html += buatTabel(['Slot', 'Status'], soalRows);

// === COMPILER ===
html += '<div style="font-family:PS2P,sans-serif;font-size:0.58em;color:#e74c3c;margin-bottom:8px;">&#x1F4BB; Compiler</div>';
var compilerRows = [];
if (compilerProg.length === 0) {
    compilerRows.push(['&mdash;', '<span style="color:#777;">Belum dikerjakan</span>']);
} else {
    compilerProg.forEach(function(p) {
        var wC = p.status === 'benar' ? '#2ecc71' : '#e74c3c';
        var lC = p.status === 'benar' ? '&#x2705; Selesai Tepat Waktu' : '&#x274C; Habis Waktu';
        compilerRows.push([p.subtopik || '-', '<span style="color:' + wC + ';">' + lC + '</span>']);
    });
}
html += buatTabel(['Subtopik', 'Status'], compilerRows);

$('#nilaiList').html(html);
    });
};

window.printRincianNilai = function(nama, topik) {
    var konten = document.getElementById('nilaiList').innerHTML;
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
    win.document.write('<title>Rincian Nilai - ' + nama + '</title>');
    win.document.write('<style>');
    win.document.write('body{background:#fff;color:#222;font-family:Arial,sans-serif;padding:24px;font-size:13px;}');
    win.document.write('h2{font-size:15px;margin-bottom:16px;}');
    win.document.write('table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}');
    win.document.write('th{background:#2c3e50;color:#fff;padding:8px 10px;text-align:left;}');
    win.document.write('td{padding:7px 10px;border-bottom:1px solid #ccc;color:#222!important;}');
    win.document.write('button,div[onclick]{display:none!important;}');
    win.document.write('span{color:#222!important;}');
    win.document.write('div[style]{background:#fff!important;color:#222!important;border-color:#ccc!important;}');
    win.document.write('@media print{body{padding:0;}}');
    win.document.write('</style></head><body>');
    win.document.write('<h2>Rincian Nilai &mdash; ' + nama + ' | Topik: ' + topik + '</h2>');
    win.document.write(konten);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(function(){ win.focus(); win.print(); }, 600);
};

window.printSemuaNilai = function() {
    var konten = document.getElementById('nilaiList').innerHTML;
    var topikLabel = activeTopikNilai === 'percabangan' ? 'Percabangan' : 'Perulangan';
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
    win.document.write('<title>Data Nilai Siswa - ' + topikLabel + '</title>');
    win.document.write('<style>');
    win.document.write('body{background:#fff;color:#222;font-family:Arial,sans-serif;padding:24px;font-size:13px;}');
    win.document.write('h2{font-size:15px;margin-bottom:16px;}');
    win.document.write('table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}');
    win.document.write('th{background:#2c3e50;color:#fff;padding:8px 10px;text-align:left;}');
    win.document.write('td{padding:7px 10px;border-bottom:1px solid #ccc;color:#222;}');
    win.document.write('button{display:none!important;}');
    win.document.write('@media print{body{padding:0;}}');
    win.document.write('</style></head><body>');
    win.document.write('<h2>Data Nilai Siswa &mdash; Topik: ' + topikLabel + '</h2>');
    win.document.write(konten);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(function(){ win.focus(); win.print(); }, 600);
};

	// topic buttons lead into game
	$('#btnBranch').click(function() {
    gameMode = 'percabangan';
    currentLevels = branchLevels;
	skorMateri = 0; skorSoal = 0; skorCompiler = 0;
    $('#selectionScreen').hide();
    $('#nameScreenTopic').text('Topik: Percabangan');
    showNameScreen(function() {
        $('#gameWrapper').show();
        level.load(currentLevels[0]);
        level.start();
        keys.bind();
        startRankingSidebar();
    });
});

$('#btnLoop').click(function() {
    gameMode = 'perulangan';
	skorMateri = 0; skorSoal = 0; skorCompiler = 0;
    currentLevels = loopLevels;
    $('#selectionScreen').hide();
    $('#nameScreenTopic').text('Topik: Perulangan');
    showNameScreen(function() {
        $('#gameWrapper').show();
        level.load(currentLevels[0]);
        level.start();
        keys.bind();
        startRankingSidebar();
    });
});

// Fungsi tampil name screen - hanya sekali per sesi
function showNameScreen(callback) {
    $('#nameInputScreen').css('display', 'flex');
    $('#playerUsernameInput').val('').focus();
    $('#playerPasswordInput').val('');
    $('#nameInputError').hide();

    // Hapus event lama biar tidak dobel
    $('#nameSubmitBtn').off('click');
    $('#playerNameInput').off('keydown');

    function doLogin() {
        var username = $('#playerUsernameInput').val().trim();
        var password = $('#playerPasswordInput').val().trim();

        if (username === '' ||password === '') {
            $('#nameInputError').text('Username dan password wajib diisi!').show();
            return;
        }

        $('#nameSubmitBtn').text('Loading...').prop('disabled', true);

        fetch('api/login_siswa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                // Simpan data siswa
                currentPlayer = {
                    id: data.siswa_id,
                    nama: data.nama,
                    username: data.username,
                    topik: gameMode,
                    skor: 0
                };
                localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));

                $('#playerNameDisplay').text(data.nama);
                $('#nameInputScreen').hide();
                $('#nameSubmitBtn').text('Masuk').prop('disabled', false);
               
                // tips muncul setelah login berhasil
                $('#tipsScreen').css('display', 'flex');
                $('#tipsStartBtn').off('click');
                $('#tipsStartBtn').on('click', function() {
                    $('#tipsScreen').hide();
					// Reset checkpoint saat mulai game baru
					for (var i = 0; i <= 3; i++) {
						localStorage.removeItem('cp_level' + i + '_num');
						localStorage.removeItem('cp_level' + i + '_x');
					}
					// Reset materi, soal dan compiler yang sudah dibuka saat game baru
					for (var i = 0; i <= 3; i++) {
						for (var s = 1; s <= 6; s++) {
							localStorage.removeItem('materi_opened_' + i + '_slot_' + s);
							localStorage.removeItem('soal_opened_' + i + '_slot_' + s);
							localStorage.removeItem('soal_opened_loop_' + i + '_slot_' + s);
							localStorage.removeItem('compiler_opened_' + i + '_slot_' + s);
                            localStorage.removeItem('materi_opened_loop_' + i + '_slot_' + s);
                            localStorage.removeItem('materi_dicatat_percabangan_slot_' + s);
                            localStorage.removeItem('materi_dicatat_perulangan_slot_' + s);
						}
					}
                    startCountdown(function() {
						loadSoalGame(gameMode, function() {
                        callback();
                    });
                });
			});

            } else {
                $('#nameInputError').text(data.message).show();
                $('#nameSubmitBtn').text('Masuk').prop('disabled', false);
            }
        })
        .catch(function() {
            $('#nameInputError').text('Gagal terhubung ke server!').show();
            $('#nameSubmitBtn').text('Masuk').prop('disabled', false);
        });
    }

    $('#nameSubmitBtn').on('click', doLogin);
    $('#playerUsernameInput, #playerPasswordInput').on('keydown', function(e) {
        if (e.key === 'Enter') doLogin();
    });
}


// ===== COUNTDOWN =====
function startCountdown(callback) {
    var count = 3;
    $('#countdownNumber').text(count);
    $('#countdownScreen').css('display', 'flex');

    var timer = setInterval(function() {
        count--;
        if (count > 0) {
            $('#countdownNumber').text(count);
            // restart animasi
            $('#countdownNumber').removeClass('pop');
            void $('#countdownNumber')[0].offsetWidth; // reflow trick
            $('#countdownNumber').addClass('pop');
        } else {
            clearInterval(timer);
            $('#countdownScreen').hide();
            callback();
        }
    }, 1000);
}
// ===== END COUNTDOWN =====

	// allow Enter/Space to start - hanya di startScreen
	$(document).keydown(function(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			if ($('#startScreen').is(':visible')) {
				$('#startButton').trigger('click');
			}
		}
	});

	// modal button logic
	$('.circle-button').click(function() {
		var modalId = $(this).data('modal');
		$('#' + modalId).css('display', 'flex');
	});

	$('.modal .close').click(function() {
		var modalId = $(this).data('modal');
		$('#' + modalId).hide();
	});
});

// Tracking skor komponen
var skorMateri   = 0;
var skorSoal     = 0;
var skorCompiler = 0;

// SISTEM PROGRESS
function catatProgress(jenis, slot, subtopik, status) {
    if (!currentPlayer || !currentPlayer.id) return;

    // Hitung skor komponen
    if (jenis === 'materi' && status === 'selesai') {
        var nilaiPerMateri = (gameMode === 'perulangan') ? 6 : 5;
        skorMateri = Math.min(skorMateri + nilaiPerMateri, 30);
    } else if (jenis === 'soal' && status === 'benar') {
        skorSoal = Math.min(skorSoal + 5, 35);
    } else if (jenis === 'compiler' && status === 'benar') {
        skorCompiler = 35;
    }

    fetch('api/catat_progress.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            siswa_id: currentPlayer.id,
            topik:    gameMode,
            jenis:    jenis,
            slot:     slot    || null,
            subtopik: subtopik || null,
            status:   status  || 'selesai'
        })
    });
}

// SISTEM PROGRESS

// ===== SISTEM MATERI =====
function showMateriPopup(slot) {
    keys.unbind();
    if (level) level.pause();

    var topik = typeof gameMode !== 'undefined' ? gameMode : 'percabangan';

    fetch('api/get_materi.php?topik=' + topik + '&slot=' + slot)
    .then(function(res) { return res.json(); })
    .then(function(materi) {
        if (!materi) {
            materi = { judul: 'Materi ' + slot, isi: 'Konten materi belum diisi oleh guru.', video_url: '' };
        }
        materi.slot = slot;
		tampilkanPopupMateri(materi);
    })
    .catch(function() {
        tampilkanPopupMateri({ judul: 'Materi ' + slot, isi: 'Gagal memuat materi.', video_url: '' });
    });
}

function tampilkanPopupMateri(materi) {
    $('#materiPopupOverlay').remove();

    // Cek apakah materi slot ini sudah pernah dicatat (pakai key unik per topik+slot)
    var materiKey = 'materi_dicatat_' + gameMode + '_slot_' + materi.slot;
    var sudahDicatat = localStorage.getItem(materiKey);
    if (!sudahDicatat) {
        localStorage.setItem(materiKey, '1');
        catatProgress('materi', materi.slot, null, 'selesai');

        if (currentPlayer && currentPlayer.id) {
            var skorMateriSekarang = Math.min(skorMateri, 30);
            fetch('api/simpan_nilai.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siswa_id: currentPlayer.id,
                    topik: gameMode,
                    skor: skorMateriSekarang + skorSoal + skorCompiler,
                    total_soal: currentPlayer.total_soal || 0,
                    benar: currentPlayer.benar || 0,
                    skor_materi: skorMateriSekarang,
                    skor_soal: skorSoal,
                    skor_compiler: skorCompiler,
                    koin: 0
                })
            }).catch(function() {});
        }
    }

    var embedUrl = null;
    if (materi.video_url) {
        var shortMatch = materi.video_url.match(/youtu\.be\/([^?&]+)/);
        var longMatch  = materi.video_url.match(/[?&]v=([^?&]+)/);
        if (shortMatch) embedUrl = 'https://www.youtube.com/embed/' + shortMatch[1];
        else if (longMatch) embedUrl = 'https://www.youtube.com/embed/' + longMatch[1];
    }

    var videoHtml = embedUrl
        ? '<iframe width="100%" height="180" src="' + embedUrl + '" frameborder="0" allowfullscreen style="border-radius:8px;margin-top:8px;"></iframe>'
        : '';
	
	var gambarHtml = materi.gambar
    ? '<img src="uploads/materi/' + materi.gambar + '" style="max-width:100%;border-radius:8px;margin-top:8px;">'
    : '';

    var html = '<div id="materiPopupOverlay" style="position:absolute;top:0;left:0;width:640px;height:480px;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding-top:40px;box-sizing:border-box;">' +
    '<div style="background:#fff;border-radius:16px;border:3px solid #e8c0c0;width:560px;max-height:400px;display:flex;flex-direction:column;box-sizing:border-box;">' +
    '<div style="font-size:1.1em;color:#c8860a;text-align:center;font-weight:bold;font-family:PS2P,sans-serif;padding:16px 24px 8px;flex-shrink:0;">' + materi.judul + '</div>' +
    '<div style="padding:0 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;">' +
    gambarHtml +
    '<div style="font-size:0.58em;color:#333;line-height:1.9;text-align:left;font-family:PS2P,sans-serif;">' + (materi.isi || '').replace(/\n/g, '<br>') + '</div>' +
    videoHtml +
    '</div>' +
    '<div style="padding:12px 24px;flex-shrink:0;display:flex;justify-content:center;">' +
    '<button id="materiPopupCloseBtn" style="background:#d0a0a0;color:#333;border:none;border-radius:30px;padding:10px 36px;font-family:PS2P,sans-serif;font-size:0.65em;cursor:pointer;box-shadow:0 4px 0 #a07070;">Tutup</button>' +
    '</div>' +
    '</div></div>';
	
    $('#game').append(html);

    $('#materiPopupCloseBtn').on('click', function() {
    var iframe = document.querySelector('#materiPopupOverlay iframe');
    if (iframe) iframe.src = iframe.src;
    $('#materiPopupOverlay').remove();

    // Animasi +10 coin
    var $coin = $('<div>').text('+10 🪙').css({
        position: 'absolute',
        left: '50%',
        bottom: '50%',
        transform: 'translateX(-50%)',
        fontSize: '1.4em',
        fontFamily: 'PS2P, sans-serif',
        color: '#f1c40f',
        textShadow: '2px 2px 0 #c8860a',
        zIndex: 99999,
        pointerEvents: 'none',
    });
    $('#game').append($coin);

    // Animasi melayang ke atas lalu fade out
    $coin.animate({ bottom: '+=120px', opacity: 0 }, 1000, function() {
        $coin.remove();
        keys.reset();
        keys.bind();
        if (level) level.start();
    });

    // Tambah 10 coin ke Mario
    if (level) {
        for (var i = level.figures.length; i--;) {
            if (level.figures[i] instanceof Mario) {
                for (var c = 0; c < 10; c++) {
                    level.figures[i].addCoin();
                }
                break;
            }
        }
    }
});
}
// ===== END SISTEM MATERI =====

// ===== SISTEM SOAL =====
function loadSoalGame(topik, callback) {
    Promise.all([
        fetch('api/get_soal.php?topik=' + topik).then(function(r) { return r.json(); }),
        fetch('api/get_materi.php?topik=' + topik).then(function(r) { return r.json(); })
    ]).then(function(results) {
        soalList = results[0];
        soalIndex = 0;
        materiList = results[1];
        materiIndex = 0;
        if (callback) callback();
    }).catch(function() {
        console.log('Gagal load soal/materi');
        if (callback) callback();
    });
}

// ===== END SISTEM SOAL =====

function formatWaktuCompiler(detik) {
    var m = Math.floor(detik / 60);
    var s = detik % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ===== COMPILER POPUP =====
var compilerTimerInterval = null;

var subtopikLabelGame = {
    'if_then_tunggal'      : 'If..Then Tunggal',
    'if_then_jamak'        : 'If..Then Pernyataan Jamak',
    'if_then_2kondisi'     : 'If..Then 2 Kondisi',
    'if_then_kondisi_jamak': 'If..Then Kondisi Jamak',
    'select_case'          : 'Select Case',
    'for_next'             : 'For..Next',
    'do_loop_while'        : 'Do..Loop While',
    'do_loop_until'        : 'Do..Loop Until',
};

var templateOtomatis = {
    'if_then_tunggal':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'if_then_jamak':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'if_then_2kondisi':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'if_then_kondisi_jamak':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'select_case':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'for_next':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'do_loop_while':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
    'do_loop_until':
        'Module Module1\n    Sub Main()\n\n    End Sub\nEnd Module',
};

function showCompilerPopup(topik) {
    keys.unbind();
    if (level) level.pause();

    fetch('api/get_active_compiler.php?topik=' + encodeURIComponent(topik))
    .then(function(res) { return res.json(); })
    .then(function(soal) {
        if (!soal) {
            $('#compilerPopup').remove();
            var errHtml =
                '<div id="compilerPopup" style="position:absolute;top:0;left:0;width:640px;height:480px;' +
                'background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">' +
                '<div style="background:#fff;border-radius:14px;border:3px solid #8e44ad;padding:24px;' +
                'text-align:center;font-family:PS2P,sans-serif;font-size:0.6em;color:#333;' +
                'display:flex;flex-direction:column;gap:16px;align-items:center;">' +
                '<div>&#x26A0;&#xFE0F; Soal compiler belum diaktifkan guru!</div>' +
                '</div></div>';
            $('#game').append(errHtml);
            return;
        }
        tampilkanCompilerPopup(soal);
    })
    .catch(function(err) {
        console.error('Gagal fetch soal compiler:', err);
        keys.reset(); keys.bind();
        if (level) level.start();
    });
}

function tampilkanCompilerPopup(soal) {
    $('#compilerPopup').remove();
    if (compilerTimerInterval) clearInterval(compilerTimerInterval);

    var sisaWaktu = parseInt(soal.waktu) || 600;
    var compilerSelesai = false;
    var template  = templateOtomatis[soal.subtopik] || templateOtomatis['if_then_tunggal'];
    var labelSub  = subtopikLabelGame[soal.subtopik] || soal.subtopik;
    var instrHtml = (soal.instruksi || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

    var html =
        '<div id="compilerPopup" style="position:absolute;top:0;left:0;width:640px;height:480px;' +
        'background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1e1e2e;border-radius:12px;border:2px solid #3a3a5c;width:626px;height:466px;' +
        'display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">' +

        // TITLE BAR
        '<div style="background:#2d2d44;padding:7px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
        '<div style="width:11px;height:11px;border-radius:50%;background:#ff5f57;"></div>' +
        '<div style="width:11px;height:11px;border-radius:50%;background:#febc2e;"></div>' +
        '<div style="width:11px;height:11px;border-radius:50%;background:#28c840;"></div>' +
        '<div style="flex:1;text-align:center;font-family:PS2P,sans-serif;font-size:0.46em;color:#ccc;">💻 ' + (soal.judul || labelSub) + '</div>' +
        '<div id="compilerTimerDisplay" style="font-family:PS2P,sans-serif;font-size:0.48em;color:#e74c3c;">' + formatWaktuCompiler(sisaWaktu) + '</div>' +
        '</div>' +

        // BODY 2 KOLOM
        '<div style="position:relative;flex:1;overflow:hidden;">' +

        // KOLOM KIRI
        '<div style="display:flex;flex-direction:column;position:absolute;left:0;top:0;bottom:0;right:210px;border-right:2px solid #3a3a5c;">' +

        // Instruksi
        '<div style="background:#252535;padding:6px 10px;font-family:PS2P,sans-serif;font-size:0.37em;' +
        'color:#bbb;line-height:1.8;border-bottom:1px solid #3a3a5c;flex-shrink:0;max-height:68px;overflow-y:auto;">' +
        '<b>' + labelSub + '</b>' + (instrHtml ? ('<br>' + instrHtml) : '') + '</div>' +

        // Editor
        '<textarea id="compilerEditor" spellcheck="false" ' +
        'style="flex:1;width:100%;font-family:monospace;font-size:0.78em;background:#1e1e2e;color:#d4d4d4;' +
        'border:none;padding:10px;resize:none;box-sizing:border-box;outline:none;line-height:1.6;tab-size:4;">' +
        template + '</textarea>' +

        '</div>' +

        // KOLOM KANAN
        '<div style="width:210px;display:flex;flex-direction:column;flex-shrink:0;position:absolute;right:0;top:0;bottom:0;">' +
        '<div style="background:#252535;padding:5px 10px;font-family:PS2P,sans-serif;font-size:0.38em;' +
        'color:#888;flex-shrink:0;border-bottom:1px solid #3a3a5c;letter-spacing:1px;">HASIL</div>' +
        '<div id="compilerOutput" style="flex:1;min-height:0;height:0;background:#1e1e2e;color:#94a3b8;font-family:monospace;' +
		'font-size:0.68em;padding:10px;white-space:pre-wrap;overflow-y:auto;line-height:1.6;">' +
        'Tulis kode di editor,\nlalu klik ▶ Run.</div>' +
        '</div>' +

        '</div>' +

        // TOOLBAR — di luar 2 kolom, selebar penuh
        '<div style="background:#2d2d44;padding:6px 10px;display:flex;gap:8px;align-items:center;' +
        'flex-shrink:0;border-top:1px solid #3a3a5c;">' +
        '<button id="btnRunCompiler" style="background:#28c840;color:#000;border:none;border-radius:5px;' +
        'padding:5px 18px;font-family:PS2P,sans-serif;font-size:0.44em;cursor:pointer;font-weight:bold;">▶ Run</button>' +
        '<div style="font-family:PS2P,sans-serif;font-size:0.36em;color:#666;">' + labelSub + '</div>' +
        '</div>' +

        '</div></div>';

    $('#game').append(html);

    // Tab key support di editor
    $('#compilerEditor').on('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var el = this, s = el.selectionStart, en = el.selectionEnd;
            el.value = el.value.substring(0, s) + '    ' + el.value.substring(en);
            el.selectionStart = el.selectionEnd = s + 4;
        }
    });

    // Timer countdown
    compilerTimerInterval = setInterval(function() {
    if (compilerSelesai) { clearInterval(compilerTimerInterval); return; }
    sisaWaktu--;
    $('#compilerTimerDisplay').text(formatWaktuCompiler(sisaWaktu));
    if (sisaWaktu <= 0) {
        clearInterval(compilerTimerInterval);
        $('#btnRunCompiler').prop('disabled', true).css('background', '#555');
        tampilHasil('⏰ Waktu habis!\nSoal belum selesai.', 'error');
        catatProgress('compiler', null, soal.subtopik, 'habis_waktu');
        setTimeout(function() {
            $('#compilerPopup').remove();
            keys.reset(); keys.bind();
            if (level) level.start();
        }, 3000);
    }
}, 1000);

    // RUN — cocokkan kode siswa vs kode guru
    $('#btnRunCompiler').on('click', function() {
        var kodeSiswa = $('#compilerEditor').val().trim();
        var kodeGuru  = (soal.kode_jawaban || '').trim();

        if (!kodeGuru) {
            tampilHasil('⚠️ Guru belum mengisi\nkode jawaban.', 'warn');
            return;
        }

        $('#btnRunCompiler').prop('disabled', true).text('...');
        tampilHasil('⏳ Mengecek kode...', 'info');

        function normalizeKode(k) {
            return k
                .replace(/'[^\n]*/g, '')
                .replace(/\r\n/g, '\n')
                .toLowerCase()
                .split('\n')
                .map(function(l) { return l.trim(); })
                .filter(function(l) { return l !== ''; })
                .join('\n');
        }

        var normSiswa  = normalizeKode(kodeSiswa);
        var normGuru   = normalizeKode(kodeGuru);
        var barisSiswa = normSiswa.split('\n');
        var barisGuru  = normGuru.split('\n');

        var cocok = 0;
        barisGuru.forEach(function(bg) {
            if (barisSiswa.indexOf(bg) !== -1) cocok++;
        });

        var persen = barisGuru.length > 0
            ? Math.round((cocok / barisGuru.length) * 100)
            : 0;

        setTimeout(function() {
            $('#btnRunCompiler').prop('disabled', false).text('▶ Run');

            if (persen >= 80) {
                // BENAR
                tampilHasil(
                    '✅ Benar! (' + persen + '% cocok)\n' +
                    '+5 Koin diterima! 🎉\n\n' +
                    '📖 Pembahasan:\n' +
                    (soal.pembahasan || '(Tidak ada pembahasan)') +
                    '\n\n📝 Kode jawaban:\n' + kodeGuru,
                    'success'
                );

                if (level) {
                    for (var i = level.figures.length; i--;) {
                        if (level.figures[i] instanceof Mario) {
                            for (var c = 0; c < 5; c++) level.figures[i].addCoin();
                            break;
                        }
                    }
                }
                if (currentPlayer) {
                    currentPlayer.benar = (currentPlayer.benar || 0) + 1;
                    currentPlayer.total_soal = (currentPlayer.total_soal || 0) + 1;
                    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
                }

                $('#btnRunCompiler').prop('disabled', true);
				clearInterval(compilerTimerInterval);
				// Tampilkan tombol tutup setelah benar
				var $toolbar = $('#compilerPopup').find('div').last();
				$('<button>').text('✕ Tutup').css({
					'margin-left': 'auto',
					'background': '#28c840',
					'color': '#000',
					'border': 'none',
					'border-radius': '5px',
					'padding': '5px 12px',
					'font-family': 'PS2P,sans-serif',
					'font-size': '0.44em',
					'cursor': 'pointer'
				}).on('click', function() {
                    compilerSelesai = true;
					catatProgress('compiler', null, soal.subtopik, 'benar');
					$('#compilerPopup').remove();
					keys.reset(); keys.bind();
					if (level) level.start();
				}).appendTo($toolbar);

            } else {
                // SALAH — tunjukkan baris mana yang tidak cocok
                var detail = '';
                var tampilMax = Math.min(barisGuru.length, 10);
                for (var j = 0; j < tampilMax; j++) {
                    var ada = barisSiswa.indexOf(barisGuru[j]) !== -1;
                    detail += (ada ? '✅ ' : '❌ ') + barisGuru[j] + '\n';
                }
                if (barisGuru.length > tampilMax) {
                    detail += '... (' + (barisGuru.length - tampilMax) + ' baris lagi)\n';
                }

                tampilHasil(
                    '❌ Belum cocok (' + persen + '%)\n\n' +
                    'Cek baris berikut:\n' + detail +
                    '\n💡 Periksa sintaks kamu\ndan coba lagi!',
                    'error'
                );
            }
        }, 400);
    });
}

function tampilHasil(pesan, tipe) {
    var warna = tipe === 'success' ? '#4ade80'
              : tipe === 'error'   ? '#f87171'
              : tipe === 'warn'    ? '#facc15'
              : '#94a3b8';
    var $out = $('#compilerOutput');
    $out.css('color', warna).text(pesan);
    $out.scrollTop(0);
}
// ===== END COMPILER POPUP =====

// Ambil soal spesifik berdasarkan slot dari DB
function showQuestionBySlot(mario, slot, topik) {
    keys.unbind();
    if (level) level.pause();

    fetch('api/get_soal.php?topik=' + topik + '&slot=' + slot)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data || data.length === 0 || !data[0].pertanyaan) {
            // Soal belum diisi guru
            keys.reset();
            keys.bind();
            if (level) level.start();
            return;
        }
        var soal = data[0];
        tampilkanSoalBySlot(mario, soal);
    })
    .catch(function() {
        keys.reset();
        keys.bind();
        if (level) level.start();
    });
}

function tampilkanSoalBySlot(mario, soal) {
    $('#soalPopup').remove();

    var pilihanHtml = '';
    var huruf = ['a','b','c','d','e'];
    huruf.forEach(function(h) {
        var teks = soal['pilihan_' + h];
        if (!teks && h === 'e') return;
        var gambar = soal['gambar_' + h];
        var isiGambar = gambar
            ? '<img src="uploads/soal/' + gambar + '" style="max-width:160px;max-height:55px;display:inline-block;vertical-align:middle;margin-left:8px;border-radius:4px;">'
            : '';
        pilihanHtml += '<button class="soal-btn" data-jawaban="' + h + '">' + h.toUpperCase() + '. ' + (teks || '') + isiGambar + '</button>';
    });

    var html = '<div id="soalPopup">' +
        '<div id="soalBox">' +
        '<div id="soalNomor">Soal ' + soal.slot + ' / 7</div>' +
        '<div id="soalPertanyaan">' + soal.pertanyaan + '</div>' +
        '<div id="soalPilihan">' + pilihanHtml + '</div>' +
        '<div id="soalFeedback"></div>' +
        '<div id="soalActionRow"></div>' +
        '</div></div>';

    $('#game').append(html);

    $('.soal-btn').on('click', function() {
        var jawaban = $(this).data('jawaban');
        $('.soal-btn').prop('disabled', true);

        if (currentPlayer) {
            currentPlayer.total_soal = (currentPlayer.total_soal || 0) + 1;
        }

        if (jawaban === soal.jawaban) {
            // BENAR
            $('.soal-btn[data-jawaban="' + jawaban + '"]').css({'background':'#d4edda','border-color':'#27ae60'});
            $('#soalFeedback').html('<span style="color:#27ae60;font-size:0.65em;">✅ Benar! +20 Koin</span>');
            if (mario) { for (var c = 0; c < 20; c++) mario.addCoin(); }
            if (currentPlayer) currentPlayer.benar = (currentPlayer.benar || 0) + 1;
            catatProgress('soal', soal.slot, null, 'benar');
            if (currentPlayer) localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));

            $('#soalActionRow').html(
                '<button id="btnNextSoal" class="soal-action-btn next-btn">▶ Lanjutkan</button>'
            );
            $('#btnNextSoal').on('click', function() {
                $('#soalPopup').remove();
                keys.reset(); keys.bind();
                if (level) level.start();
            });

        } else {
            // SALAH
            $('.soal-btn[data-jawaban="' + jawaban + '"]').css({'background':'#fde8e8','border-color':'#e74c3c'});
            $('.soal-btn[data-jawaban="' + soal.jawaban + '"]').css({'background':'#d4edda','border-color':'#27ae60'});
            $('#soalFeedback').html('<span style="color:#e74c3c;font-size:0.65em;">❌ Salah!</span>');
            if (currentPlayer) localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
            catatProgress('soal', soal.slot, null, 'salah');

            $('#soalActionRow').html(
                '<button id="btnLihatPembahasan" class="soal-action-btn pembahasan-btn">💡 Pembahasan</button>'
            );
            $('#btnLihatPembahasan').on('click', function() {
                var isi = (soal.pembahasan && soal.pembahasan.trim() !== '')
                    ? soal.pembahasan
                    : '(Pembahasan belum tersedia)';
                var popup =
                    '<div id="pembahasanOverlay" style="position:absolute;top:0;left:0;width:100%;height:100%;' +
                    'background:rgba(0,0,0,0.7);z-index:6000;display:flex;align-items:center;justify-content:center;">' +
                    '<div style="background:#fff;border-radius:14px;border:3px solid #3498db;padding:22px 24px;' +
                    'width:460px;font-family:PS2P,sans-serif;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
                    '<div style="font-size:0.6em;color:#3498db;">💡 Pembahasan</div>' +
                    '<div style="font-size:0.52em;color:#222;line-height:1.9;">' + isi + '</div>' +
                    '<div style="font-size:0.5em;color:#e74c3c;">Jawaban benar: <b>' + soal.jawaban.toUpperCase() + '</b></div>' +
                    '<button id="btnTutupPembahasan" style="background:#e74c3c;color:#fff;border:none;border-radius:8px;' +
                    'padding:8px 20px;font-family:PS2P,sans-serif;font-size:0.5em;cursor:pointer;align-self:flex-end;">Selanjutnya</button>' +
                    '</div></div>';
                $('#game').append(popup);
                $('#btnTutupPembahasan').on('click', function() {
                    $('#pembahasanOverlay').remove();
                    $('#soalPopup').remove();
                    keys.reset(); keys.bind();
                    if (level) level.start();
                });
            });
        }
    });
}

// ===== LEADERBOARD POPUP (SEMENTARA & FINAL) =====
function showLeaderboardPopup(tipe, callback) {
    fetch('api/get_leaderboard.php?topik=' + gameMode)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var topikLabel = gameMode === 'percabangan' ? 'Percabangan' : 'Perulangan';
        var medal = ['🥇','🥈','🥉'];
        var isFinal = tipe === 'final';

        var judul = isFinal
            ? '🏆 Leaderboard Final'
            : '📊 Leaderboard Sementara';
        var subjudul = isFinal
            ? 'Hasil akhir topik ' + topikLabel
            : 'Setelah level materi ' + topikLabel;
        var warnaBorder = isFinal ? '#f1c40f' : '#3498db';
        var warnaJudul  = isFinal ? '#c8860a' : '#2980b9';

        function buatRows(arr) {
            var r = '';
            arr.forEach(function(s, idx) {
                var isMe = (currentPlayer && s.nama === currentPlayer.nama);
                var bg   = isMe ? 'background:#fff9e6;font-weight:bold;' : (idx % 2 === 0 ? 'background:#fff;' : 'background:#f9f9f9;');
                var rank = medal[idx] || (idx + 1);
                if (isFinal) {
                    r += '<tr style="' + bg + '">' +
                        '<td style="text-align:center;padding:7px 6px;">' + rank + '</td>' +
                        '<td style="padding:7px 6px;">' + s.nama + (isMe ? ' <span style="color:#e74c3c;font-size:0.85em;">(Kamu)</span>' : '') + '</td>' +
                        '<td style="text-align:center;padding:7px 6px;">' + (s.materi_selesai || 0) + '</td>' +
                        '<td style="text-align:center;padding:7px 6px;">' + (s.soal_benar || 0) + '</td>' +
                        '<td style="text-align:center;padding:7px 6px;">' + (s.compiler_selesai > 0 ? '✅' : '—') + '</td>' +
                        '<td style="text-align:center;padding:7px 6px;color:#e67e22;font-weight:bold;">' + (s.poin || 0) + '</td>' +
                        '</tr>';
                } else {
                    r += '<tr style="' + bg + '">' +
                        '<td style="text-align:center;padding:7px 6px;">' + rank + '</td>' +
                        '<td style="padding:7px 6px;">' + s.nama + (isMe ? ' <span style="color:#e74c3c;font-size:0.85em;">(Kamu)</span>' : '') + '</td>' +
                        '<td style="text-align:center;padding:7px 6px;color:#f1c40f;font-weight:bold;">🪙 ' + (s.koin || 0) + '</td>' +
                        '</tr>';
                }
            });
            if (!r) r = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:12px;">Belum ada data</td></tr>';
            return r;
        }
        var rows = buatRows(data);

        var btnLabel = isFinal ? 'Kembali ke Menu' : 'Lanjut ▶';
        var btnWarna = isFinal ? '#e74c3c' : '#27ae60';

        var html =
            '<div id="leaderboardPopupOverlay" style="position:absolute;top:0;left:0;width:640px;height:480px;' +
            'background:rgba(0,0,0,0.78);z-index:9999;display:flex;align-items:center;justify-content:center;">' +
            '<div style="background:#fff;border-radius:16px;border:3px solid ' + warnaBorder + ';padding:22px 26px;' +
            'width:530px;max-height:450px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;">' +
            '<div style="text-align:center;font-family:PS2P,sans-serif;font-size:0.75em;color:' + warnaJudul + ';">' + judul + '</div>' +
            '<div style="text-align:center;font-family:PS2P,sans-serif;font-size:0.48em;color:#888;">' + subjudul + '</div>' +
            '<div style="overflow-y:auto;flex:1;">' +
            '<table style="width:100%;border-collapse:collapse;font-family:PS2P,sans-serif;font-size:0.46em;">' +
            '<thead><tr style="background:' + warnaBorder + ';color:' + (isFinal ? '#333' : '#fff') + ';">' +
            '<th style="padding:7px;">#</th>' +
            '<th style="padding:7px;text-align:left;">Nama</th>' +
            (isFinal
                ? '<th style="padding:7px;">Materi</th><th style="padding:7px;">Soal ✅</th><th style="padding:7px;">Compiler</th><th style="padding:7px;">Poin</th>'
                : '<th style="padding:7px;">🪙 Koin</th>'
            ) +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table></div>' +
            '<button id="btnLanjutLeaderboard" style="background:' + btnWarna + ';color:#fff;border:none;border-radius:20px;' +
            'padding:9px 28px;font-family:PS2P,sans-serif;font-size:0.55em;cursor:pointer;align-self:center;">' + btnLabel + '</button>' +
            '</div></div>';

        $('#leaderboardPopupOverlay').remove();
        $('#game').append(html);

        // Auto-refresh tabel setiap 3 detik
        var refreshInterval = setInterval(function() {
            if ($('#leaderboardPopupOverlay').length === 0) { clearInterval(refreshInterval); return; }
            fetch('api/get_leaderboard.php?topik=' + gameMode)
            .then(function(res) { return res.json(); })
            .then(function(fresh) {
                $('#leaderboardPopupOverlay tbody').html(buatRows(fresh));
            });
        }, 10000);

        $('#btnLanjutLeaderboard').on('click', function() {
            clearInterval(refreshInterval);
            $('#leaderboardPopupOverlay').remove();
            if (callback) callback();
        });
    })
    .catch(function() {
        if (callback) callback();
    });
}
// ===== END LEADERBOARD POPUP =====

// ===== LEADERBOARD =====
function showLeaderboard(callback) {
    fetch('api/get_leaderboard.php?topik=' + gameMode)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var topikLabel = gameMode === 'percabangan' ? 'Percabangan' : 'Perulangan';
        var medal = ['🥇','🥈','🥉'];

        var rows = '';
        data.forEach(function(s, i) {
            var isMe = (currentPlayer && s.nama === currentPlayer.nama);
            var bg   = isMe ? 'background:#fff9e6;font-weight:bold;' : '';
            var rank = medal[i] || (i + 1);
            rows +=
                '<tr style="' + bg + '">' +
                '<td style="text-align:center;">' + rank + '</td>' +
                '<td>' + s.nama + (isMe ? ' <span style="color:#e74c3c;font-size:0.8em;">(Kamu)</span>' : '') + '</td>' +
                '<td style="text-align:center;">' + (s.materi_selesai || 0) + '</td>' +
                '<td style="text-align:center;">' + (s.soal_benar || 0) + '</td>' +
                '<td style="text-align:center;">' + (s.compiler_selesai > 0 ? '✅' : '—') + '</td>' +
                '<td style="text-align:center;color:#f1c40f;font-weight:bold;">' + (s.poin || 0) + '</td>' +
                '</tr>';
        });

        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:#aaa;">Belum ada data</td></tr>';

        var html =
            '<div id="leaderboardOverlay" style="position:absolute;top:0;left:0;width:640px;height:480px;' +
            'background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;">' +
            '<div style="background:#fff;border-radius:16px;border:3px solid #f1c40f;padding:24px 28px;' +
            'width:520px;max-height:440px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
            '<div style="text-align:center;font-family:PS2P,sans-serif;font-size:0.8em;color:#c8860a;">🏆 Leaderboard</div>' +
            '<div style="text-align:center;font-family:PS2P,sans-serif;font-size:0.55em;color:#888;">Topik: ' + topikLabel + '</div>' +
            '<div style="overflow-y:auto;flex:1;">' +
            '<table style="width:100%;border-collapse:collapse;font-family:PS2P,sans-serif;font-size:0.48em;">' +
            '<thead><tr style="background:#f1c40f;color:#333;">' +
            '<th style="padding:6px;">#</th>' +
            '<th style="padding:6px;text-align:left;">Nama</th>' +
            '<th style="padding:6px;">Materi</th>' +
            '<th style="padding:6px;">Soal ✅</th>' +
            '<th style="padding:6px;">Compiler</th>' +
            '<th style="padding:6px;">Poin</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table></div>' +
            '<button id="btnTutupLeaderboard" style="background:#e74c3c;color:#fff;border:none;border-radius:20px;' +
            'padding:8px 24px;font-family:PS2P,sans-serif;font-size:0.55em;cursor:pointer;align-self:center;">Tutup</button>' +
            '</div></div>';

        $('#game').append(html);

        $('#btnTutupLeaderboard').on('click', function() {
            $('#leaderboardOverlay').remove();
            if (callback) {
                callback();
            } else {
                keys.reset(); keys.bind();
                if (level) level.start();
            }
        });
    })
    .catch(function() {
        if (callback) callback();
    });
}
// ===== END LEADERBOARD =====

// ===== RANKING SIDEBAR REALTIME =====
var rankingSidebarInterval = null;
var rankingAutoSaveInterval = null;
var rankingSidebarOpen = false;
var rankingPrevData = [];

function startRankingSidebar() {
    var label = (typeof gameMode !== 'undefined' && gameMode === 'perulangan') ? 'Perulangan' : 'Percabangan';
    $('#rankingTopikLabel').text(label);

    rankingSidebarOpen = false;
    $('#rankingArrow').text('◀');
    // Reset ke posisi tersembunyi (geser ke kanan, di luar batas wrapper)
    $('#rankingSidebar').css({ display:'flex', right: '-158px' });
    $('#rankingToggleBtn').css({ display:'flex', right: '0px' });

    setTimeout(function() {
        // Posisi toggle btn: tengah vertikal wrapper, nempel di kanan
        // Sidebar: tersembunyi di kanan (right: -158px), muncul ke right: 0

        $('#rankingToggleBtn').off('click').on('click', function() {
            if (rankingSidebarOpen) {
                // Tutup: geser sidebar keluar ke kanan
                $('#rankingSidebar').css('right', '-158px');
                $('#rankingToggleBtn').css('right', '0px');
                $('#rankingArrow').text('◀');
                rankingSidebarOpen = false;
            } else {
                // Buka: geser sidebar masuk dari kanan
                $('#rankingSidebar').css('right', '0px');
                $('#rankingToggleBtn').css('right', '155px');
                $('#rankingArrow').text('▶');
                rankingSidebarOpen = true;
            }
        });

        // Fetch pertama langsung
        fetchRankingSidebar();

        // Auto-refresh sidebar setiap 10 detik
        clearInterval(rankingSidebarInterval);
        rankingSidebarInterval = setInterval(fetchRankingSidebar, 10000);
    }, 150);

    // Auto-save koin setiap 30 detik
    clearInterval(rankingAutoSaveInterval);
    rankingAutoSaveInterval = setInterval(function() {
        if (!currentPlayer || !currentPlayer.id) return;
        var koinSekarang = 0;
        if (typeof level !== 'undefined' && level && level.figures) {
            for (var i = level.figures.length; i--;) {
                if (level.figures[i] instanceof Mario) {
                    koinSekarang = level.figures[i].coins || 0;
                    break;
                }
            }
        }
        // Simpan di background — tidak ganggu game
        fetch('api/simpan_nilai.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siswa_id: currentPlayer.id,
                topik: gameMode,
                skor: skorMateri + skorSoal + skorCompiler,
                total_soal: currentPlayer.total_soal || 0,
                benar: currentPlayer.benar || 0,
                skor_materi: skorMateri,
                skor_soal: skorSoal,
                skor_compiler: skorCompiler,
                koin: koinSekarang
            })
        }).catch(function() {});
    }, 30000);
}

function fetchRankingSidebar() {
    var topik = (typeof gameMode !== 'undefined') ? gameMode : 'percabangan';
    fetch('api/get_leaderboard.php?topik=' + topik)
    .then(function(res) { return res.json(); })
    .then(function(data) {
        renderRankingSidebar(data);
    })
    .catch(function() {});
}

function renderRankingSidebar(data) {
    var medal = ['🥇','🥈','🥉'];
    var html = '';

    var prevMap = {};
    rankingPrevData.forEach(function(d, i) { prevMap[d.nama] = i; });

    data.forEach(function(s, idx) {
        var isMe = (typeof currentPlayer !== 'undefined' && currentPlayer && s.nama === currentPlayer.nama);
        var rankIcon = medal[idx] || '<span style="color:#aaa;font-size:9px;">' + (idx+1) + '</span>';
        var changed = (prevMap[s.nama] !== undefined && prevMap[s.nama] !== idx) ? ' rank-changed' : '';
        var meClass = isMe ? ' is-me' : '';

        html += '<div class="ranking-item' + meClass + changed + '">' +
            '<span class="ranking-medal">' + rankIcon + '</span>' +
            '<span class="ranking-nama' + (isMe ? ' is-me' : '') + '">' +
                (isMe ? '▶ ' : '') + s.nama +
            '</span>' +
            '<span class="ranking-poin">🪙 ' + (s.koin || 0) + '</span>' +
        '</div>';
    });

    if (!html) {
        html = '<div style="text-align:center;color:#888;font-size:0.3em;padding:16px 8px;">Belum ada data</div>';
    }

    $('#rankingList').html(html);
    rankingPrevData = data;
}

function stopRankingSidebar() {
    clearInterval(rankingSidebarInterval);
    clearInterval(rankingAutoSaveInterval);
    rankingSidebarInterval = null;
    rankingAutoSaveInterval = null;
    $('#rankingSidebar').css('display', 'none');
    $('#rankingToggleBtn').css('display', 'none');
    rankingSidebarOpen = false;
    rankingPrevData = [];
}
// ===== END RANKING SIDEBAR REALTIME =====