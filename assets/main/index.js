System.register("chunks:///_virtual/Battle.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Model.ts'], function (exports) {
  var _extends, _createForOfIteratorHelperLoose, _createClass, cclegacy, stats, quote, LocalAuthority;
  return {
    setters: [function (module) {
      _extends = module.extends;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      stats = module.stats;
      quote = module.quote;
      LocalAuthority = module.LocalAuthority;
    }],
    execute: function () {
      cclegacy._RF.push({}, "b7b74QLsz9CnqFX4C0SP5yi", "Battle", undefined);
      /** All combat times are integer microseconds. Rendering never awards damage or currency. */
      var Battle = exports('Battle', /*#__PURE__*/function () {
        function Battle(config, data, epoch) {
          this.now = 0;
          this.epochOrigin = void 0;
          this.enemy = null;
          this.encounter = '';
          this.attempt = '';
          this.deadline = 0;
          this.log = [];
          this.lastFailure = null;
          this.onCommit = function () {};
          this.onEvent = function () {};
          this.queue = [];
          this.seq = 0;
          this.used = new Set();
          this.buffUntil = 0;
          this.buffValue = 0;
          this.snapshot = null;
          this.autoGate = 0;
          this.nextShotAt = 0;
          this.authority = new LocalAuthority();
          this.config = config;
          this.data = data;
          this.epochOrigin = Math.max(epoch, data.saved_at);
          if (epoch < data.saved_at) data.clock_suspect = true;
          if (data.run.mode === 'boss') {
            data.run.mode = 'farming';
            data.run.farming = Math.max(1, data.run.frontier - 1);
            data.run.retry_at = this.epochOrigin + Number(config.combat.auto_retry_interval_ms);
            this.lastFailure = {
              remaining: 1,
              stage: data.run.frontier,
              reason: 'interrupted'
            };
          }
          this.enter(data.run.mode === 'farming' ? 'farming' : 'normal');
        }
        var _proto = Battle.prototype;
        _proto.n = function n(key) {
          return Number(this.config.combat[key]);
        };
        _proto.id = function id(prefix) {
          return prefix + "-" + ++this.data.serial;
        };
        _proto.schedule = function schedule(at, priority, action, persistent) {
          if (persistent === void 0) {
            persistent = false;
          }
          this.queue.push({
            at: Math.round(at),
            priority: priority,
            seq: ++this.seq,
            action: action,
            persistent: persistent
          });
        };
        _proto.emit = function emit(kind, extra) {
          if (extra === void 0) {
            extra = {};
          }
          var e = _extends({
            at: this.now,
            kind: kind
          }, extra);
          this.log.push(e);
          if (this.log.length > 4000) this.log.shift();
          this.onEvent(e);
        };
        _proto.commit = function commit() {
          this.data.revision++;
          this.data.saved_at = this.epoch;
          this.onCommit();
        };
        _proto.advanceTo = function advanceTo(us) {
          if (!Number.isFinite(us) || us < this.now) throw Error('INVALID_TIME');
          for (;;) {
            this.queue.sort(function (a, b) {
              return a.at - b.at || a.priority - b.priority || a.seq - b.seq;
            });
            var e = this.queue[0];
            if (!e || e.at > us) break;
            this.queue.shift();
            this.now = e.at;
            e.action();
          }
          this.now = Math.round(us);
        };
        _proto.enter = function enter(mode) {
          var _this = this;
          this.queue = this.queue.filter(function (e) {
            return e.persistent;
          });
          this.used.clear();
          this.buffUntil = 0;
          this.buffValue = 0;
          this.snapshot = null;
          this.enemy = null;
          this.encounter = this.id('encounter');
          this.data.run.mode = mode;
          this.autoGate = this.now;
          if (mode === 'boss') {
            this.nextShotAt = this.now;
            this.snapshot = stats(this.config, this.data.run.training);
            this.attempt = this.id('attempt');
            this.data.run.boss_nuke_used = false;
            this.deadline = this.now + this.n('boss_duration_ms') * 1000;
            this.schedule(this.deadline, 0, function () {
              return _this.fail('timeout');
            });
          }
          this.unlock();
          this.spawn();
          this.schedule(this.now, 5, function () {
            return _this.autoTick();
          });
          this.commit();
        };
        _proto.unlock = function unlock() {
          var d = this.data;
          d.account.highest_reached = Math.max(d.account.highest_reached, d.run.frontier);
          d.run.highest_reached = Math.max(d.run.highest_reached, d.run.frontier);
          if (d.account.highest_reached >= 5) for (var _i = 0, _Object$values = Object.values(d.supports.presets); _i < _Object$values.length; _i++) {
            var p = _Object$values[_i];
            if (p.filter(Boolean).length === 0) p[0] = 'grenade';
          }
        };
        _proto.spawn = function spawn() {
          var _this2 = this;
          this.used.clear();
          var stage = this.data.run.mode === 'farming' ? this.data.run.farming : this.data.run.frontier;
          var boss = this.data.run.mode === 'boss';
          var hp = this.n('normal_hp_base') * Math.pow(this.n('normal_hp_growth'), stage - 1) * (boss ? this.n('boss_hp_multiplier') : 1);
          this.enemy = {
            id: this.id('enemy'),
            hp: hp,
            maxHp: hp,
            boss: boss,
            stage: stage
          };
          this.emit('spawn', {
            target: this.enemy.id,
            stage: stage
          });
          var target = this.enemy.id;
          this.schedule(Math.max(this.now + this.n('basic_first_shot_delay_ms') * 1000, this.nextShotAt), 6, function () {
            var _this2$enemy;
            if (((_this2$enemy = _this2.enemy) == null ? void 0 : _this2$enemy.id) === target) _this2.fire();
          });
        };
        _proto.random = function random() {
          var x = this.data.rng;
          x ^= x << 13;
          x ^= x >>> 17;
          x ^= x << 5;
          this.data.rng = x >>> 0;
          return this.data.rng / 4294967296;
        };
        _proto.fire = function fire() {
          var _this3 = this;
          if (!this.enemy) return;
          var s = this.currentStats;
          var critical = this.random() < s.critical;
          var hit = {
            id: this.id('shot'),
            run: this.data.run_id,
            encounter: this.encounter,
            target: this.enemy.id,
            at: this.now + this.n('basic_hit_delay_ms') * 1000,
            damage: s.attack * (critical ? s.criticalMultiplier : 1),
            source: 'pistol',
            basic: true
          };
          this.emit('fire', {
            id: hit.id,
            target: hit.target,
            source: hit.source
          });
          this.scheduleHit(hit);
          var target = hit.target;
          this.nextShotAt = this.now + Math.round(1000000 / s.rate);
          this.schedule(this.nextShotAt, 6, function () {
            var _this3$enemy;
            if (((_this3$enemy = _this3.enemy) == null ? void 0 : _this3$enemy.id) === target) _this3.fire();
          });
        };
        _proto.scheduleCommand = function scheduleCommand(at, action, withdraw) {
          if (withdraw === void 0) {
            withdraw = false;
          }
          this.schedule(Math.max(this.now, at), withdraw ? 0 : 4, action, true);
        };
        _proto.scheduleHit = function scheduleHit(hit) {
          var _this4 = this;
          this.schedule(hit.at, 2, function () {
            return _this4.applyHit(hit);
          });
        };
        _proto.applyHit = function applyHit(h) {
          if (h.run !== this.data.run_id || h.encounter !== this.encounter || !this.enemy || h.target !== this.enemy.id || this.used.has(h.id) || !Number.isFinite(h.damage) || h.damage < 0) return false;
          if (this.data.run.mode === 'boss' && this.now >= this.deadline) {
            this.fail('timeout');
            return false;
          }
          this.used.add(h.id);
          var damage = h.damage * (h.basic && this.now < this.buffUntil ? 1 + this.buffValue : 1);
          this.enemy.hp = Math.max(0, this.enemy.hp - damage);
          this.emit('hit', {
            id: h.id,
            target: h.target,
            amount: damage,
            source: h.source
          });
          if (this.enemy.hp === 0) this.killed();
          return true;
        };
        _proto.killed = function killed() {
          var e = this.enemy;
          this.enemy = null;
          var d = this.data;
          var amount = this.n('normal_gold_base') * Math.pow(this.n('normal_gold_growth'), e.stage - 1) * (e.boss ? this.n('boss_gold_multiplier') : 1);
          d.run.gold = String(Number(d.run.gold) + amount);
          this.emit('reward', {
            id: this.id('tx'),
            target: e.id,
            amount: amount,
            stage: e.stage
          });
          if (e.boss) {
            if (!d.account.first_boss.includes(e.stage)) {
              d.account.first_boss.push(e.stage);
              d.wallet.parts = String(Number(d.wallet.parts) + this.config.parts_income.first_boss_clear_parts);
            }
            this.emit('boss_success', {
              stage: e.stage
            });
            this.completeStage();
          } else if (d.run.mode === 'normal') {
            d.run.normal_kills++;
            if (d.run.normal_kills >= this.n('normal_kills_per_stage')) {
              if (d.run.frontier % this.n('boss_every_n_stages') === 0) this.enter('boss');else this.completeStage();
            } else this.nextEnemy();
          } else this.nextEnemy();
          this.commit();
        };
        _proto.nextEnemy = function nextEnemy() {
          var _this5 = this;
          // Remove target-bound shots/fire; retain support readiness and buffs, never retarget hits.
          var encounter = this.encounter;
          this.schedule(this.now + this.n('next_enemy_gap_ms') * 1000, 3, function () {
            if (_this5.encounter === encounter && !_this5.enemy) _this5.spawn();
          });
        };
        _proto.completeStage = function completeStage() {
          var d = this.data;
          d.run.highest_cleared = Math.max(d.run.highest_cleared, d.run.frontier);
          d.account.highest_cleared = Math.max(d.account.highest_cleared, d.run.frontier);
          d.run.normal_kills = 0;
          if (d.run.frontier >= this.config.scope.p0_stage_limit) {
            d.run.farming = d.run.frontier;
            this.enter('farming');
          } else {
            d.run.frontier++;
            this.enter('normal');
          }
        };
        _proto.fail = function fail(reason) {
          if (this.data.run.mode !== 'boss') return false;
          this.lastFailure = {
            remaining: this.enemy ? this.enemy.hp / this.enemy.maxHp : 0,
            stage: this.data.run.frontier,
            reason: reason
          };
          this.emit('boss_failed', {
            stage: this.data.run.frontier
          });
          this.data.run.retry_at = this.epoch + this.n('auto_retry_interval_ms');
          this.data.run.farming = Math.max(1, this.data.run.frontier - 1);
          this.enter('farming');
          return true;
        };
        _proto.retry = function retry() {
          if (this.data.run.mode !== 'farming' || this.data.run.frontier <= this.data.run.highest_cleared) return false;
          this.lastFailure = null;
          this.enter('boss');
          return true;
        };
        _proto.buy = function buy(stat, mode) {
          if (this.data.run.mode === 'boss') return 'BOSS_LOADOUT_LOCKED';
          var c = this.config.training[stat];
          if (this.data.account.highest_reached < c.unlock_reached_stage) return 'LOCKED';
          var q = quote(c, this.data.run.training[stat], Number(this.data.run.gold), mode);
          if (!q.count) return c.max_level !== null && this.data.run.training[stat] >= c.max_level ? 'MAX_LEVEL' : 'INSUFFICIENT_CURRENCY';
          if (!this.authority.validate(q.cost, Number(this.data.run.gold))) return 'INSUFFICIENT_CURRENCY';
          this.data.run.gold = String(Number(this.data.run.gold) - q.cost);
          this.data.run.training[stat] += q.count;
          this.data.mission.trained += q.count;
          this.emit('training', {
            source: stat,
            amount: q.count
          });
          this.commit();
          return 'OK';
        };
        _proto.unlocked = function unlocked(id) {
          var s = this.config.supports.find(function (x) {
            return x.id === id;
          });
          return !!s && (this.data.test_profile && ['grenade', 'adrenaline', 'missile', 'nuke'].includes(id) || this.data.account.highest_reached >= s.unlock_reached_stage && this.data.account.prestige_count >= s.unlock_prestige_count);
        };
        _proto.setPreset = function setPreset(kind, ids) {
          var _this6 = this;
          if (this.data.run.mode === 'boss') return 'BOSS_LOADOUT_LOCKED';
          var filled = ids.filter(Boolean);
          if (new Set(filled).size !== filled.length) return 'DUPLICATE_SLOT';
          if (ids.length !== 4 || ids.some(function (id, i) {
            return id && (i >= _this6.slotCount || !_this6.unlocked(id));
          })) return 'LOCKED';
          this.data.supports.presets[kind] = ids.slice();
          this.commit();
          return 'OK';
        };
        _proto.setPolicy = function setPolicy(id, p) {
          this.data.supports.policies[id] = p;
          this.commit();
        };
        _proto.remaining = function remaining(id) {
          return Math.max(0, (this.data.supports.ready_at[id] - this.epoch) / 1000);
        };
        _proto.cast = function cast(id) {
          var _this7 = this;
          var s = this.config.supports.find(function (x) {
            return x.id === id;
          });
          if (!s || !this.unlocked(id) || !this.activePreset.includes(id)) return 'LOCKED';
          if (!this.enemy) return 'INVALID_TARGET';
          if (id === 'nuke' && this.data.run.mode === 'boss' && this.data.run.boss_nuke_used) return 'ATTEMPT_LIMIT';
          if (this.remaining(id) > 0) return 'NOT_READY';
          this.data.supports.ready_at[id] = this.epoch + s.cooldown_ms;
          if (id === 'nuke' && this.data.run.mode === 'boss') this.data.run.boss_nuke_used = true;
          this.emit('cast', {
            source: id,
            target: this.enemy.id
          });
          if (s.kind === 'buff') {
            this.buffUntil = this.now + s.buff_duration_ms * 1000;
            this.buffValue = Math.min(this.n('temporary_buff_channel_cap'), s.buff_value);
            var expiry = this.buffUntil;
            this.schedule(expiry, 1, function () {
              if (_this7.buffUntil === expiry) {
                _this7.buffValue = 0;
                _this7.emit('buff_expired', {
                  source: id
                });
              }
            });
          } else {
            var attack = this.id('support');
            s.hit_offsets_ms.forEach(function (ms, i) {
              return _this7.scheduleHit({
                id: attack + "-" + i + "-" + _this7.enemy.id,
                run: _this7.data.run_id,
                encounter: _this7.encounter,
                target: _this7.enemy.id,
                at: _this7.now + ms * 1000,
                damage: _this7.currentStats.baseline * s.damage_coefficients[i],
                source: id
              });
            });
          }
          this.commit();
          return 'OK';
        };
        _proto.autoTick = function autoTick() {
          var _this8 = this;
          if (this.data.run.mode === 'farming' && this.data.run.frontier > this.data.run.highest_cleared && this.data.supports.auto_retry && this.epoch >= (this.data.run.retry_at || 0)) {
            this.retry();
            return;
          }
          if (this.data.supports.auto && this.enemy && this.now >= this.autoGate) {
            for (var _iterator = _createForOfIteratorHelperLoose(this.activePreset), _step; !(_step = _iterator()).done;) {
              var id = _step.value;
              if (!id) continue;
              var policy = this.data.supports.policies[id];
              if (policy === 'manual' || policy === 'boss_only' && this.data.run.mode !== 'boss') continue;
              if (this.cast(id) === 'OK') {
                this.autoGate = this.now + this.n('auto_support_spacing_ms') * 1000;
                break;
              }
            }
          }
          this.schedule(this.now + 10000, 5, function () {
            return _this8.autoTick();
          });
        };
        _proto.claimMission = function claimMission() {
          var m = this.data.mission;
          if (m.claimed) return 'ALREADY_CLAIMED';
          if (m.trained < 1) return 'LOCKED';
          var reward = this.config.main_missions.find(function (x) {
            return x.id === 'main_train';
          });
          m.claimed = true;
          this.data.wallet.parts = String(Number(this.data.wallet.parts) + reward.reward_parts);
          this.data.wallet.gems = String(Number(this.data.wallet.gems) + reward.reward_gems);
          this.commit();
          return 'OK';
        };
        _proto.suspend = function suspend() {
          if (this.data.run.mode === 'boss') this.fail('interrupted');
          this.queue = [];
          this.buffUntil = 0;
          this.commit();
        };
        _createClass(Battle, [{
          key: "epoch",
          get: function get() {
            return this.epochOrigin + this.now / 1000;
          }
        }, {
          key: "currentStats",
          get: function get() {
            return this.snapshot || stats(this.config, this.data.run.training);
          }
        }, {
          key: "activePreset",
          get: function get() {
            return this.data.supports.presets[this.data.run.mode === 'boss' ? 'boss' : 'farming'];
          }
        }, {
          key: "slotCount",
          get: function get() {
            var _this9 = this;
            return this.data.test_profile ? 4 : this.config.support_slot_unlocks.filter(function (n) {
              return n <= _this9.data.account.highest_reached;
            }).length;
          }
        }]);
        return Battle;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleView.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Graphics;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Graphics = module.Graphics;
    }],
    execute: function () {
      cclegacy._RF.push({}, "097d2gHpEpH+pIaWvSryUM5", "BattleView", undefined);
      var BattleView = exports('BattleView', /*#__PURE__*/function () {
        function BattleView(ui, node, height) {
          this.art = void 0;
          this.effects = void 0;
          this.events = [];
          this.ui = ui;
          this.node = node;
          this.height = height;
          this.art = ui.group('PixelBattle', 0, 0, node).addComponent(Graphics);
          this.effects = ui.group('Effects', 0, 0, node).addComponent(Graphics);
        }
        var _proto = BattleView.prototype;
        _proto.event = function event(e) {
          if (['fire', 'hit', 'cast'].includes(e.kind)) {
            this.events.push(e);
            if (this.events.length > 30) this.events.shift();
          }
        };
        _proto.render = function render(b) {
          var _this = this;
          var g = this.art;
          g.clear();
          var y = this.height - 22;
          var r = function r(x, t, w, h, c) {
            g.fillColor = _this.ui.color(c);
            g.rect(x, -t - h, w, h);
            g.fill();
          };
          r(0, 0, 360, this.height, 'battle_olive');
          r(0, 30, 360, 55, '#7E9581');
          for (var i = 0; i < 8; i++) r(i * 51, 44 + i % 3 * 12, 42, 70, '#4D6659');
          r(0, y - 10, 360, 32, '#9F9472');
          r(0, y + 14, 360, 8, '#756D54');
          for (var _i = 0; _i < 14; _i++) r(_i * 29, y - 17 + _i % 2 * 5, 18, 8, '#879071');
          var firing = this.events.some(function (e) {
            return e.kind === 'fire' && b.now - e.at >= 0 && b.now - e.at < 60000;
          });
          var x = 68 - (firing ? 2 : 0);
          // Adult silhouette: head 13px, total height 82px; beret, ponytail, boots, pistol.
          r(x - 4, y - 78, 13, 17, '#342F30');
          r(x - 9, y - 71, 6, 28, '#44372E');
          r(x, y - 77, 12, 15, '#D6AE82');
          r(x - 5, y - 82, 23, 7, '#B96543');
          r(x - 4, y - 61, 21, 28, '#26383B');
          r(x - 1, y - 58, 17, 21, '#A4AA6E');
          r(x + 4, y - 57, 22, 7, '#ADB276');
          r(x + 22, y - 55, 10, 6, '#D6AE82');
          r(x + 31, y - 58, 19, 6, '#122A35');
          r(x + 31, y - 52, 6, 8, '#122A35');
          r(x - 4, y - 53, 6, 22, '#667A58');
          r(x - 3, y - 34, 21, 5, '#E3B66C');
          r(x - 2, y - 29, 8, 23, '#5A6F50');
          r(x + 10, y - 29, 8, 23, '#738260');
          r(x - 3, y - 7, 12, 7, '#172B32');
          r(x + 10, y - 7, 12, 7, '#172B32');
          if (firing) {
            r(x + 52, y - 60, 10, 5, 'action');
            r(x + 55, y - 63, 4, 11, 'action');
          }
          var enemy = b.enemy;
          var ex = 269;
          if (enemy != null && enemy.boss) {
            r(ex - 30, y - 42, 94, 33, '#172D35');
            r(ex - 26, y - 39, 86, 22, '#829888');
            r(ex - 18, y - 16, 74, 16, '#173039');
            for (var _i2 = 0; _i2 < 5; _i2++) r(ex - 14 + _i2 * 14, y - 12, 9, 8, '#B1B8A0');
            r(ex - 8, y - 56, 42, 20, '#41584F');
            r(ex - 36, y - 49, 33, 7, '#213740');
            r(ex + 18, y - 52, 7, 5, 'danger');
          } else if (enemy) {
            r(ex - 8, y - 67, 22, 17, '#162E39');
            r(ex - 5, y - 63, 16, 6, '#D17B4B');
            r(ex - 12, y - 47, 31, 30, '#162E39');
            r(ex - 7, y - 43, 21, 21, '#8AA399');
            r(ex - 18, y - 43, 6, 21, '#263C45');
            r(ex + 20, y - 43, 6, 21, '#263C45');
            r(ex - 8, y - 17, 8, 17, '#172B35');
            r(ex + 9, y - 17, 8, 17, '#172B35');
            r(ex - 12, y - 4, 15, 4, '#172B35');
            r(ex + 8, y - 4, 15, 4, '#172B35');
          }
          r(16, 4, 328, 30, 'background');
          if (enemy) {
            r(18, 29, 324 * enemy.hp / enemy.maxHp, 4, enemy.boss ? 'danger' : 'action');
          }
          var fx = this.effects;
          fx.clear();
          var f = function f(x, t, w, h, c) {
            fx.fillColor = _this.ui.color(c);
            fx.rect(x, -t - h, w, h);
            fx.fill();
          };
          for (var _iterator = _createForOfIteratorHelperLoose(this.events), _step; !(_step = _iterator()).done;) {
            var e = _step.value;
            var age = (b.now - e.at) / 1000;
            if (age < 0) continue;
            if (e.kind === 'fire' && age < 160) f(120 + age / 160 * 144, y - 54, 8, 2, 'action');
            if (e.kind === 'hit' && age < 160) f(255, y - 43, 18, 18, '#D8C57C');
            if (e.kind === 'cast' && e.source === 'grenade' && age < 350) f(115 + age / 350 * 155, y - 50 - Math.sin(age / 350 * Math.PI) * 40, 6, 8, 'action');
            if (e.kind === 'cast' && e.source === 'missile' && age < 1500) {
              var phase = age % 300;
              f(250, phase / 300 * (y - 40), 4, 16, 'action');
            }
            if (e.kind === 'cast' && e.source === 'nuke' && age >= 900 && age < 1500) {
              var reduced = b.data.ui.reduced_fx;
              if (reduced) f(250, y - 45, 28, 25, 'danger');else {
                f(247, y - 92, 23, 76, 'danger');
                f(215, y - 114, 82, 32, 'danger');
                f(229, y - 127, 55, 22, 'action');
                f(205, y - 99, 104, 16, '#E7AC62');
              }
            }
          }
          this.events = this.events.filter(function (e) {
            return b.now - e.at < 1600000;
          });
        };
        return BattleView;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameSession.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Battle.ts', './Model.ts'], function (exports) {
  var _extends, cclegacy, Battle, validateConfig, newSave;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      Battle = module.Battle;
    }, function (module) {
      validateConfig = module.validateConfig;
      newSave = module.newSave;
    }],
    execute: function () {
      cclegacy._RF.push({}, "fb0bbAhds9FULbp6v3UAvEY", "GameSession", undefined);
      var BrowserClock = exports('BrowserClock', /*#__PURE__*/function () {
        function BrowserClock() {}
        var _proto = BrowserClock.prototype;
        _proto.monotonicMs = function monotonicMs() {
          return performance.now();
        };
        _proto.epochMs = function epochMs() {
          return Date.now();
        };
        return BrowserClock;
      }());
      var GameSession = exports('GameSession', /*#__PURE__*/function () {
        function GameSession(config, store, clock, test) {
          var _this = this;
          if (test === void 0) {
            test = false;
          }
          this.battle = void 0;
          this.data = void 0;
          this.recovered = false;
          this.saveError = false;
          this.suspended = false;
          this.anchor = 0;
          this.lastSave = 0;
          this.committing = false;
          this.requestSerial = 0;
          this.config = config;
          this.store = store;
          this.clock = clock;
          validateConfig(config);
          var loaded = store.load();
          this.recovered = loaded.recovered;
          this.data = loaded.data || newSave(config, clock.epochMs(), test);
          if (this.data.test_profile !== test) throw Error('SAVE_CORRUPT');
          this.battle = new Battle(config, this.data, clock.epochMs());
          this.battle.onCommit = function () {
            if (!_this.committing) _this.save();
          };
          this.anchor = clock.monotonicMs();
          this.save();
        }
        var _proto2 = GameSession.prototype;
        _proto2.tick = function tick() {
          if (this.suspended) return;
          this.battle.advanceTo(Math.round(Math.max(0, this.clock.monotonicMs() - this.anchor) * 1000));
          if (this.battle.now - this.lastSave >= this.config.persistence.autosave_seconds * 1000000) this.save();
        };
        _proto2.save = function save() {
          this.data.saved_at = this.battle.epoch;
          try {
            this.store.write(this.data);
            this.saveError = false;
            this.lastSave = this.battle.now;
          } catch (_unused) {
            this.saveError = true;
          }
        };
        _proto2.buy = function buy(stat, mode) {
          return this.command({
            type: 'buy',
            stat: stat,
            mode: mode
          });
        };
        _proto2.cast = function cast(id) {
          return this.command({
            type: 'cast',
            id: id
          });
        };
        _proto2.selectTab = function selectTab(tab) {
          this.data.ui.tab = tab;
          this.save();
        };
        _proto2.policy = function policy(id, p) {
          this.command({
            type: 'policy',
            id: id,
            policy: p
          });
        };
        _proto2.preset = function preset(kind, ids) {
          return this.command({
            type: 'preset',
            kind: kind,
            ids: ids
          });
        };
        _proto2.retry = function retry() {
          return this.command({
            type: 'retry'
          });
        };
        _proto2.withdraw = function withdraw() {
          return this.command({
            type: 'withdraw'
          });
        };
        _proto2.claim = function claim() {
          return this.command({
            type: 'claim'
          });
        };
        _proto2.command = function command(payload) {
          var _this2 = this;
          if (this.suspended) return 'LOCKED';
          var code = 'LOCKED';
          var at = Math.round(Math.max(0, this.clock.monotonicMs() - this.anchor) * 1000);
          this.battle.scheduleCommand(at, function () {
            code = _this2.execute({
              request_id: "ui-" + _this2.clock.epochMs() + "-" + ++_this2.requestSerial,
              account_id: 'local',
              run_id: _this2.data.run_id,
              expected_revision: _this2.data.revision,
              config_version: _this2.config.config_version,
              payload: payload
            }).code;
          }, payload.type === 'withdraw');
          this.tick();
          return code;
        };
        _proto2.execute = function execute(e) {
          var _this3 = this;
          var fingerprint = JSON.stringify([e.account_id, e.run_id, e.config_version, Object.keys(e.payload).sort().map(function (k) {
            return [k, e.payload[k]];
          })]);
          var result = function result(code) {
            return {
              code: code,
              revision: _this3.data.revision,
              balances: _extends({
                gold: _this3.data.run.gold
              }, _this3.data.wallet),
              replayed: false
            };
          };
          var records = this.data.requests || (this.data.requests = {});
          var previous = records[e.request_id];
          if (previous) return previous.fingerprint === fingerprint ? _extends({}, previous.result, {
            replayed: true
          }) : result('REQUEST_PAYLOAD_CONFLICT');
          if (e.config_version !== this.config.config_version) return result('CONFIG_MISMATCH');
          if (e.account_id !== 'local' || e.run_id !== this.data.run_id || e.expected_revision !== this.data.revision) return result('REVISION_CONFLICT');
          var p = e.payload;
          var code = 'LOCKED';
          this.committing = true;
          try {
            if (p.type === 'buy' && ['attack', 'rapid', 'critical'].includes(String(p.stat)) && [1, 10, 'max'].includes(p.mode)) code = this.battle.buy(p.stat, p.mode);else if (p.type === 'cast' && typeof p.id === 'string') code = this.battle.cast(p.id);else if (p.type === 'preset' && ['farming', 'boss'].includes(String(p.kind)) && Array.isArray(p.ids)) code = this.battle.setPreset(p.kind, p.ids);else if (p.type === 'policy' && this.config.supports.some(function (s) {
              return s.id === p.id;
            }) && ['auto', 'boss_only', 'manual'].includes(String(p.policy))) {
              this.battle.setPolicy(p.id, p.policy);
              code = 'OK';
            } else if (p.type === 'retry') code = this.battle.retry() ? 'OK' : 'LOCKED';else if (p.type === 'withdraw') code = this.battle.fail('withdraw') ? 'OK' : 'LOCKED';else if (p.type === 'claim') code = this.battle.claimMission();
          } finally {
            this.committing = false;
          }
          var response = result(code);
          records[e.request_id] = {
            fingerprint: fingerprint,
            result: response
          };
          this.save();
          return response;
        };
        _proto2.suspend = function suspend() {
          if (this.suspended) return;
          this.tick();
          this.battle.suspend();
          this.suspended = true;
          this.save();
        };
        _proto2.resume = function resume() {
          var _this4 = this;
          if (!this.suspended) return;
          var event = this.battle.onEvent;
          this.battle = new Battle(this.config, this.data, this.clock.epochMs());
          this.battle.onCommit = function () {
            if (!_this4.committing) _this4.save();
          };
          this.battle.onEvent = event;
          this.anchor = this.clock.monotonicMs();
          this.lastSave = 0;
          this.suspended = false;
          this.save();
        }
        /** Explicitly isolated test profile. No normal-account progression is touched. */;
        _proto2.testBoss = function testBoss(stage) {
          if (stage === void 0) {
            stage = 5;
          }
          if (!this.data.test_profile) return;
          this.data.run.frontier = stage;
          this.data.run.highest_reached = stage;
          this.data.account.highest_reached = stage;
          this.data.run.highest_cleared = stage - 1;
          this.data.run.farming = stage - 1;
          this.data.run.mode = 'farming';
          this.battle.retry();
        };
        return GameSession;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./ProjectBootstrap.ts', './GameSession.ts', './Battle.ts', './Model.ts', './SaveStore.ts', './BattleView.ts', './Widgets.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/Model.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        bulkCost: bulkCost,
        newSave: newSave,
        quote: quote,
        stats: stats,
        validateConfig: validateConfig
      });
      cclegacy._RF.push({}, "7fd7exImJRAtb1gXTiZuN/N", "Model", undefined);
      var LocalAuthority = exports('LocalAuthority', /*#__PURE__*/function () {
        function LocalAuthority() {
          this.kind = 'local-prototype';
        }
        var _proto = LocalAuthority.prototype;
        _proto.validate = function validate(a, b) {
          return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= a;
        };
        return LocalAuthority;
      }());
      function validateConfig(c) {
        if (c.schema_version !== 1 || !c.config_version || c.scope.p0_stage_limit !== 50) throw Error('CONFIG_MISMATCH');
        for (var _i = 0, _arr = ['normal_hp_base', 'normal_hp_growth', 'normal_gold_base', 'normal_gold_growth', 'boss_duration_ms', 'basic_hit_delay_ms']; _i < _arr.length; _i++) {
          var k = _arr[_i];
          if (!(Number(c.combat[k]) > 0)) throw Error('CONFIG_MISMATCH');
        }
        for (var _i2 = 0, _Object$values = Object.values(c.training); _i2 < _Object$values.length; _i2++) {
          var t = _Object$values[_i2];
          if (!(t.cost_base > 0 && t.cost_growth > 1)) throw Error('CONFIG_MISMATCH');
        }
        if (new Set(c.supports.map(function (s) {
          return s.id;
        })).size !== c.supports.length) throw Error('CONFIG_MISMATCH');
      }
      function newSave(c, epoch, test) {
        if (test === void 0) {
          test = false;
        }
        var tabs = {};
        for (var _i3 = 0, _arr2 = ['hero', 'armory', 'support', 'squad', 'operations', 'supply']; _i3 < _arr2.length; _i3++) {
          var id = _arr2[_i3];
          tabs[id] = {
            scroll: 0,
            bulk: 1,
            sub: 0
          };
        }
        return {
          schema_version: 1,
          config_version: c.config_version,
          revision: 0,
          run_id: "run-" + epoch,
          saved_at: epoch,
          rng: 773123,
          serial: 0,
          test_profile: test,
          account: {
            highest_reached: 1,
            highest_cleared: 0,
            first_boss: [],
            prestige_count: 0
          },
          run: {
            frontier: 1,
            farming: 1,
            highest_reached: 1,
            highest_cleared: 0,
            normal_kills: 0,
            mode: 'normal',
            gold: '0',
            training: {
              attack: 0,
              rapid: 0,
              critical: 0
            },
            boss_nuke_used: false
          },
          wallet: {
            parts: '0',
            medals: '0',
            gems: '0'
          },
          supports: {
            ready_at: Object.fromEntries(c.supports.map(function (s) {
              return [s.id, 0];
            })),
            policies: Object.fromEntries(c.supports.map(function (s) {
              return [s.id, s.default_policy];
            })),
            presets: {
              farming: [null, null, null, null],
              boss: [null, null, null, null]
            },
            auto: true,
            auto_retry: false
          },
          mission: {
            trained: 0,
            claimed: false
          },
          ui: {
            tab: 'hero',
            locale: 'ko',
            reduced_fx: false,
            tabs: tabs
          },
          clock_suspect: false
        };
      }
      function stats(c, levels) {
        var a = c.training.attack,
          r = c.training.rapid,
          p = c.training.critical;
        var attack = Number(a.base_attack) * Math.pow(Number(a.power_growth), levels.attack);
        var rate = Math.min(Number(r.cap_attacks_per_second), Number(r.base_attacks_per_second) + Number(r.increase_per_level) * levels.rapid);
        var critical = Math.min(Number(p.probability_cap), Number(p.probability_base) + Number(p.increase_per_level) * levels.critical);
        var criticalMultiplier = Number(p.damage_multiplier);
        return {
          attack: attack,
          rate: rate,
          critical: critical,
          criticalMultiplier: criticalMultiplier,
          baseline: attack * rate * (1 + critical * (criticalMultiplier - 1))
        };
      }
      function bulkCost(c, level, count) {
        return count === 0 ? 0 : c.cost_base * Math.pow(c.cost_growth, level) * Math.expm1(count * Math.log(c.cost_growth)) / (c.cost_growth - 1);
      }
      function quote(c, level, balance, mode) {
        var cap = c.max_level === null ? 10000 : c.max_level;
        var count = mode === 'max' ? Math.min(cap - level, Math.max(0, Math.floor(Math.log1p(balance * (c.cost_growth - 1) / (c.cost_base * Math.pow(c.cost_growth, level))) / Math.log(c.cost_growth)))) : Math.min(mode, cap - level);
        if (mode === 'max') {
          while (count > 0 && bulkCost(c, level, count) > balance) count--;
          while (count < cap - level && bulkCost(c, level, count + 1) <= balance) count++;
        }
        return {
          count: count,
          cost: bulkCost(c, level, count)
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/ProjectBootstrap.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Model.ts', './SaveStore.ts', './GameSession.ts', './Widgets.ts', './BattleView.ts'], function (exports) {
  var _inheritsLoose, _extends, _createForOfIteratorHelperLoose, _createClass, cclegacy, _decorator, screen, view, ResolutionPolicy, resources, JsonAsset, Node, UITransform, sys, profiler, game, Game, Label, Mask, ScrollView, Vec2, Sprite, Texture2D, SpriteFrame, Component, stats, quote, SaveStore, GameSession, BrowserClock, Widgets, BattleView;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _extends = module.extends;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      screen = module.screen;
      view = module.view;
      ResolutionPolicy = module.ResolutionPolicy;
      resources = module.resources;
      JsonAsset = module.JsonAsset;
      Node = module.Node;
      UITransform = module.UITransform;
      sys = module.sys;
      profiler = module.profiler;
      game = module.game;
      Game = module.Game;
      Label = module.Label;
      Mask = module.Mask;
      ScrollView = module.ScrollView;
      Vec2 = module.Vec2;
      Sprite = module.Sprite;
      Texture2D = module.Texture2D;
      SpriteFrame = module.SpriteFrame;
      Component = module.Component;
    }, function (module) {
      stats = module.stats;
      quote = module.quote;
    }, function (module) {
      SaveStore = module.SaveStore;
    }, function (module) {
      GameSession = module.GameSession;
      BrowserClock = module.BrowserClock;
    }, function (module) {
      Widgets = module.Widgets;
    }, function (module) {
      BattleView = module.BattleView;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "407edBcooZHqpm4yUHgKcsw", "ProjectBootstrap", undefined);
      var ccclass = _decorator.ccclass;
      var tabs = ['hero', 'armory', 'support', 'squad', 'operations', 'supply'];
      var ProjectBootstrap = exports('ProjectBootstrap', (_dec = ccclass('ProjectBootstrap'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(ProjectBootstrap, _Component);
        function ProjectBootstrap() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.session = void 0;
          _this.ui = void 0;
          _this.battleView = void 0;
          _this.panels = new Map();
          _this.scrolls = new Map();
          _this.popup = null;
          _this.elapsed = 0;
          _this.notice = '';
          _this.noticeUntil = 0;
          _this.failureSeen = null;
          _this.height = 800;
          _this.panelTop = 388;
          _this.navTop = 720;
          _this.preset = 'farming';
          _this.slot = 0;
          _this.visibility = function () {
            if (typeof document !== 'undefined' && document.hidden) _this.hide();else _this.show();
          };
          _this.pagehide = function () {
            return _this.hide();
          };
          return _this;
        }
        var _proto = ProjectBootstrap.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          var frame = screen.windowSize;
          this.height = Math.max(639, Math.min(1000, frame.height / frame.width * 360));
          view.setDesignResolutionSize(360, this.height, ResolutionPolicy.SHOW_ALL);
          resources.load('i18n/strings', JsonAsset, function (error, strings) {
            if (error) {
              console.error(error);
              return;
            }
            resources.load('data/game_config', JsonAsset, function (err, config) {
              if (err) {
                console.error(err);
                return;
              }
              if (_this2.isValid) _this2.boot(config.json, strings.json);
            });
          });
        };
        _proto.boot = function boot(config, tables) {
          var _this3 = this;
          var test = typeof location !== 'undefined' && new URLSearchParams(location.search).get('profile') === 'test';
          var root = new Node('PersistentShell');
          root.parent = this.node;
          root.setPosition(-180, this.height / 2);
          root.layer = this.node.layer;
          root.addComponent(UITransform).setContentSize(360, this.height);
          this.ui = new Widgets(root, tables, function () {
            var _this3$session;
            return ((_this3$session = _this3.session) == null ? void 0 : _this3$session.data.ui.locale) || 'ko';
          }, config.ui.tokens);
          try {
            this.session = new GameSession(config, new SaveStore(sys.localStorage, config, test), new BrowserClock(), test);
          } catch (error) {
            this.ui.box('LoadFailure', 0, 0, 360, this.height, 'background');
            this.ui.text('save.corrupt', 24, 120, 312, 220, 20);
            console.error(error);
            return;
          }
          profiler.hideStats();
          this.shell();
          if (typeof document !== 'undefined') document.title = this.t('app.title');
          this.session.battle.onEvent = function (e) {
            return _this3.battleView.event(e);
          };
          game.on(Game.EVENT_HIDE, this.hide, this);
          game.on(Game.EVENT_SHOW, this.show, this);
          if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
          if (typeof window !== 'undefined') {
            window.addEventListener('pagehide', this.pagehide);
            window.__armyGirl = {
              session: this.session,
              root: this.node,
              selectTab: function selectTab(tab) {
                return _this3.changeTab(tab);
              },
              setFrameRate: function setFrameRate(fps) {
                if (test && [15, 30, 60, 120].includes(fps)) game.frameRate = fps;
              },
              version: 'P0'
            };
          }
          if (this.session.recovered) this.toast('save.recovered');
        };
        _proto.number = function number(n) {
          return new Intl.NumberFormat(this.session.data.ui.locale, {
            maximumFractionDigits: n < 100 ? 1 : 0,
            notation: n >= 10000 ? 'compact' : 'standard'
          }).format(n);
        };
        _proto.statNumber = function statNumber(n) {
          return new Intl.NumberFormat(this.d.ui.locale, {
            maximumFractionDigits: 3
          }).format(n);
        };
        _proto.t = function t(key, args) {
          if (args === void 0) {
            args = {};
          }
          return this.ui.t(key, args);
        };
        _proto.result = function result(code) {
          if (code !== 'OK') this.toast('error.' + code.toLowerCase());else this.ui.refresh();
        };
        _proto.toast = function toast(key) {
          this.notice = key;
          this.noticeUntil = performance.now() + 3000;
        };
        _proto.shell = function shell() {
          var _this4 = this;
          var u = this.ui;
          this.navTop = this.height - 72;
          var battleHeight = this.height < 730 ? 160 : 196;
          var supportTop = 104 + battleHeight;
          this.panelTop = supportTop + 116;
          u.box('Background', 0, 0, 360, this.height, 'background');
          u.icon('gold', 12, 12, 22, u.root, function () {
            return 'action';
          });
          u.label('Gold', 42, 6, 152, 32, 23, function () {
            return _this4.number(Number(_this4.d.run.gold));
          }, u.root, 'action');
          u.label('Profile', 12, 38, 274, 22, 12, function () {
            return _this4.t(_this4.d.test_profile ? 'profile.test' : 'profile.name');
          }, u.root, 'info');
          u.label('Wallet', 192, 4, 108, 48, 12, function () {
            return _this4.t('resource.compact', {
              gems: _this4.number(Number(_this4.d.wallet.gems)),
              medals: _this4.number(Number(_this4.d.wallet.medals))
            });
          }, u.root);
          u.button('Settings', 306, 8, 46, 44, function () {
            return _this4.t('settings.open');
          }, function () {
            return _this4.settings();
          }, u.root, function () {
            return true;
          }, true);
          u.box('StageHud', 0, 64, 360, 36, 'panel');
          u.label('StageText', 12, 64, 224, 36, 14, function () {
            return _this4.t(_this4.d.run.mode === 'farming' ? 'stage.farming' : 'stage.normal', {
              stage: _this4.d.run.mode === 'farming' ? _this4.d.run.farming : _this4.d.run.frontier,
              frontier: _this4.d.run.frontier
            });
          });
          u.label('Progress', 238, 64, 110, 36, 14, function () {
            return _this4.d.run.mode === 'boss' ? _this4.t('boss.timer', {
              seconds: Math.max(0, (_this4.b.deadline - _this4.b.now) / 1000000).toFixed(1)
            }) : _this4.d.run.mode === 'farming' ? _this4.t('stage.farmprogress') : _this4.t('stage.kills', {
              kills: _this4.d.run.normal_kills
            });
          }, u.root, 'action', true);
          var arena = u.group('BattleViewport', 0, 100, u.root, 360, battleHeight);
          this.battleView = new BattleView(u, arena, battleHeight);
          u.label('EnemyLabel', 22, 7, 170, 22, 12, function () {
            return _this4.t(_this4.d.run.mode === 'boss' ? 'enemy.boss' : 'enemy.normal');
          }, arena);
          u.label('EnemyHP', 192, 7, 145, 22, 12, function () {
            return _this4.b.enemy ? _this4.t('enemy.hp', {
              hp: _this4.number(_this4.b.enemy.hp),
              max: _this4.number(_this4.b.enemy.maxHp)
            }) : _this4.t('enemy.incoming');
          }, arena, 'text', true);
          u.label('AutoFire', 10, battleHeight - 21, 240, 18, 10, function () {
            return _this4.t('battle.auto');
          }, arena, 'background');
          var _loop = function _loop(i) {
            var ready = function ready() {
              return !!_this4.b.activePreset[i] && _this4.b.remaining(_this4.b.activePreset[i]) === 0;
            };
            var slot = u.button('SupportSlot' + i, 8 + i * 69, supportTop, 64, 64, function () {
              var id = _this4.b.activePreset[i];
              if (i >= _this4.b.slotCount) return _this4.t('support.unlockshort', {
                stage: _this4.session.config.support_slot_unlocks[i]
              });
              if (!id) return _this4.t('support.empty');
              var sec = _this4.b.remaining(id);
              return sec > 0 ? _this4.t('time.seconds', {
                value: Math.ceil(sec)
              }) : _this4.t('support.short.' + id);
            }, function () {
              var id = _this4.b.activePreset[i];
              if (id) _this4.result(_this4.session.cast(id));else _this4.changeTab('support');
            }, u.root, ready, true);
            var label = slot.getChildByName('SupportSlot' + i + '.label');
            label.setPosition(3, -37);
            label.getComponent(UITransform).setContentSize(58, 24);
            label.getComponent(Label).fontSize = 11;
            u.icon(function () {
              return _this4.b.activePreset[i] || (i < _this4.b.slotCount ? 'plus' : 'lock');
            }, 21, 7, 24, slot, function () {
              return ready() ? 'action' : 'info';
            });
            u.meter('Cooldown', 5, 60, 54, 3, function () {
              var id = _this4.b.activePreset[i];
              return id ? 1 - _this4.b.remaining(id) * 1000 / _this4.session.config.supports.find(function (s) {
                return s.id === id;
              }).cooldown_ms : 0;
            }, slot);
          };
          for (var i = 0; i < 4; i++) {
            _loop(i);
          }
          u.button('AutoSupport', 288, supportTop, 64, 64, function () {
            return _this4.t(_this4.d.supports.auto ? 'support.auto.on' : 'support.auto.off');
          }, function () {
            _this4.d.supports.auto = !_this4.d.supports.auto;
            _this4.session.save();
          }, u.root, function () {
            return _this4.d.supports.auto;
          }, true);
          u.button('Mission', 8, supportTop + 68, 344, 44, function () {
            return _this4.t(_this4.d.mission.claimed ? 'mission.done' : _this4.d.mission.trained ? 'mission.claim' : 'mission.train');
          }, function () {
            if (_this4.d.mission.trained) _this4.result(_this4.session.claim());else _this4.changeTab('hero');
          }, u.root, function () {
            return _this4.d.mission.trained > 0 && !_this4.d.mission.claimed;
          }, true);
          for (var _i = 0, _tabs = tabs; _i < _tabs.length; _i++) {
            var tab = _tabs[_i];
            this.createPanel(tab);
          }
          tabs.forEach(function (tab, i) {
            var n = u.button('Tab.' + tab, i * 60, _this4.navTop, 60, 64, function () {
              return _this4.t('tab.' + tab);
            }, function () {
              return _this4.changeTab(tab);
            }, u.root, function () {
              return _this4.d.ui.tab === tab;
            }, true);
            var label = n.getChildByName('Tab.' + tab + '.label');
            label.setPosition(2, -38);
            label.getComponent(UITransform).setContentSize(56, 22);
            label.getComponent(Label).fontSize = 11;
            u.icon(tab, 18, 9, 24, n, function () {
              return _this4.d.ui.tab === tab ? 'action' : 'info';
            });
            u.meter('Selected', 1, 0, 58, 3, function () {
              return _this4.d.ui.tab === tab ? 1 : 0;
            }, n);
          });
          u.label('Footer', 8, this.height - 9, 344, 9, 8, function () {
            return _this4.t(_this4.session.saveError ? 'save.failed' : 'app.footer');
          }, u.root, 'info', true);
          var toast = u.box('Toast', 8, this.panelTop - 34, 344, 32, 'background');
          u.label('NoticeText', 6, 0, 332, 32, 12, function () {
            return _this4.notice ? _this4.t(_this4.notice) : _this4.t('panel.' + _this4.d.ui.tab);
          }, toast, 'action');
          u.bindings.push({
            node: toast,
            update: function update() {
              toast.active = performance.now() < _this4.noticeUntil;
            }
          });
          this.changeTab(this.d.ui.tab, false);
        };
        _proto.createPanel = function createPanel(tab) {
          var _this5 = this;
          var u = this.ui;
          var panel = u.box('Panel.' + tab, 0, this.panelTop, 360, this.navTop - this.panelTop, 'panel');
          this.panels.set(tab, panel);
          var h = this.navTop - this.panelTop - 4;
          var viewport = u.group('Viewport', 0, 0, panel, 360, h);
          viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
          var content = u.group('Content', 0, 0, viewport, 360, tab === 'support' ? 1180 : tab === 'hero' ? 358 : 680);
          var scroll = viewport.addComponent(ScrollView);
          scroll.content = content;
          scroll.horizontal = false;
          scroll.vertical = true;
          scroll.inertia = true;
          scroll.elastic = false;
          scroll.node.on('scroll-ended', function () {
            _this5.d.ui.tabs[tab].scroll = Math.max(0, scroll.getScrollOffset().y);
            _this5.session.save();
          });
          this.scrolls.set(tab, scroll);
          if (tab === 'hero') this.hero(content);else if (tab === 'support') this.support(content);else if (tab === 'operations') this.operations(content);else this.placeholder(tab, content);
        };
        _proto.hero = function hero(p) {
          var _this6 = this;
          var u = this.ui;
          ['training', 'rank', 'outfit'].forEach(function (id, i) {
            return u.button('HeroSub.' + id, 8 + i * 115, 0, 112, 44, function () {
              return _this6.t('hero.' + id);
            }, function () {
              _this6.d.ui.tabs.hero.sub = i;
              _this6.session.save();
              if (i) _this6.info('hero.' + id, 'hero.' + id + '.body');
            }, p, function () {
              return _this6.d.ui.tabs.hero.sub === i;
            }, true);
          });
          u.label('DPS', 12, 46, 142, 44, 16, function () {
            return _this6.t('hero.dps', {
              value: _this6.number(_this6.b.currentStats.baseline)
            });
          }, p, 'action');
          [1, 10, 'max'].forEach(function (count, i) {
            return u.button('Bulk.' + count, 163 + i * 62, 46, 60, 44, function () {
              return count === 'max' ? _this6.t('buy.max') : _this6.t('buy.count', {
                count: count
              });
            }, function () {
              _this6.d.ui.tabs.hero.bulk = count;
              _this6.session.save();
            }, p, function () {
              return _this6.d.ui.tabs.hero.bulk === count;
            }, true);
          });
          ['attack', 'rapid', 'critical'].forEach(function (stat, i) {
            var y = 94 + i * 70;
            u.box('Training.' + stat, 8, y, 344, 66, 'card', p, 'border');
            u.box('StatIcon.' + stat, 13, y + 9, 40, 44, 'background', p, 'border');
            u.icon(stat, 21, y + 19, 24, p, function () {
              return 'info';
            });
            var q = function q() {
              return quote(_this6.session.config.training[stat], _this6.d.run.training[stat], Number(_this6.d.run.gold), _this6.d.ui.tabs.hero.bulk);
            };
            u.label('TrainingName.' + stat, 60, y + 4, 166, 26, 13, function () {
              return _this6.t('training.level', {
                name: _this6.t('training.' + stat),
                level: _this6.d.run.training[stat]
              });
            }, p);
            u.label('TrainingValue.' + stat, 60, y + 30, 166, 30, 12, function () {
              var _extends2;
              var before = stats(_this6.session.config, _this6.d.run.training);
              var after = stats(_this6.session.config, _extends({}, _this6.d.run.training, (_extends2 = {}, _extends2[stat] = _this6.d.run.training[stat] + q().count, _extends2)));
              var field = stat === 'rapid' ? 'rate' : stat;
              return _this6.t(stat === 'critical' ? 'training.compactpercent' : 'training.compact', {
                before: _this6.statNumber(before[field] * (stat === 'critical' ? 100 : 1)),
                after: _this6.statNumber(after[field] * (stat === 'critical' ? 100 : 1))
              });
            }, p, 'info');
            u.button('Buy.' + stat, 236, y + 6, 108, 54, function () {
              return _this6.d.run.mode === 'boss' ? _this6.t('training.bosslock') : _this6.d.account.highest_reached < _this6.session.config.training[stat].unlock_reached_stage ? _this6.t('unlock.stage', {
                stage: _this6.session.config.training[stat].unlock_reached_stage
              }) : q().count === 0 ? _this6.t('buy.none') : _this6.t('buy.price', {
                count: q().count,
                cost: _this6.number(q().cost)
              });
            }, function () {
              return _this6.result(_this6.session.buy(stat, _this6.d.ui.tabs.hero.bulk));
            }, p, function () {
              return _this6.d.run.mode !== 'boss' && q().count > 0 && q().cost <= Number(_this6.d.run.gold) && _this6.d.account.highest_reached >= _this6.session.config.training[stat].unlock_reached_stage;
            });
          });
          u.text('training.hint', 12, 308, 332, 48, 12, p, 'info');
        };
        _proto.support = function support(p) {
          var _this7 = this;
          var u = this.ui;
          u.button('PresetFarming', 8, 0, 169, 44, function () {
            return _this7.t('preset.farming');
          }, function () {
            _this7.preset = 'farming';
            u.refresh();
          }, p, function () {
            return _this7.preset === 'farming';
          }, true);
          u.button('PresetBoss', 183, 0, 169, 44, function () {
            return _this7.t('preset.boss');
          }, function () {
            _this7.preset = 'boss';
            u.refresh();
          }, p, function () {
            return _this7.preset === 'boss';
          }, true);
          var _loop2 = function _loop2(i) {
            u.button('EquipSlot' + i, 8 + i * 87, 50, 82, 54, function () {
              return _this7.t('support.equipslot', {
                slot: i + 1,
                name: _this7.d.supports.presets[_this7.preset][i] ? _this7.t('support.short.' + _this7.d.supports.presets[_this7.preset][i]) : _this7.t('support.empty')
              });
            }, function () {
              _this7.slot = i;
              u.refresh();
            }, p, function () {
              return _this7.slot === i;
            }, true);
          };
          for (var i = 0; i < 4; i++) {
            _loop2(i);
          }
          u.label('EquipHint', 12, 107, 236, 44, 12, function () {
            return _this7.t('support.choose', {
              slot: _this7.slot + 1
            });
          }, p, 'info');
          u.button('Unequip', 253, 107, 99, 44, function () {
            return _this7.t('support.remove');
          }, function () {
            var ids = [].concat(_this7.d.supports.presets[_this7.preset]);
            ids[_this7.slot] = null;
            _this7.result(_this7.session.preset(_this7.preset, ids));
          }, p, function () {
            return _this7.d.run.mode !== 'boss';
          }, true);
          this.session.config.supports.forEach(function (s, i) {
            var y = 161 + i * 121;
            u.box('SupportCard.' + s.id, 8, y, 344, 113, 'card', p, 'border');
            u.label('SupportTitle.' + s.id, 18, y + 4, 215, 25, 15, function () {
              return _this7.t('support.' + s.id);
            }, p);
            u.label('SupportDescription.' + s.id, 18, y + 30, 209, 69, 11, function () {
              return _this7.t('support.desc.' + s.id, {
                seconds: s.cooldown_ms / 1000,
                remaining: Math.ceil(_this7.b.remaining(s.id))
              });
            }, p, 'info');
            u.button('Equip.' + s.id, 235, y + 7, 104, 45, function () {
              return _this7.b.unlocked(s.id) ? _this7.t('support.equip') : _this7.t('unlock.stage', {
                stage: s.unlock_reached_stage
              });
            }, function () {
              var ids = [].concat(_this7.d.supports.presets[_this7.preset]);
              ids[_this7.slot] = s.id;
              _this7.result(_this7.session.preset(_this7.preset, ids));
            }, p, function () {
              return _this7.b.unlocked(s.id) && _this7.d.run.mode !== 'boss';
            });
            u.button('Policy.' + s.id, 235, y + 59, 104, 45, function () {
              return _this7.t('policy.' + _this7.d.supports.policies[s.id]);
            }, function () {
              var ps = ['auto', 'boss_only', 'manual'];
              _this7.session.policy(s.id, ps[(ps.indexOf(_this7.d.supports.policies[s.id]) + 1) % 3]);
            }, p, function () {
              return true;
            }, true);
          });
        };
        _proto.operations = function operations(p) {
          var _this8 = this;
          var u = this.ui;
          u.label('OperationTitle', 12, 8, 336, 36, 21, function () {
            return _this8.t(_this8.d.run.mode === 'boss' ? 'operations.boss' : 'operations.frontier', {
              stage: _this8.d.run.frontier
            });
          }, p);
          u.label('OperationDetails', 12, 53, 336, 70, 14, function () {
            return _this8.t('operations.stats', {
              best: _this8.d.run.highest_reached,
              cleared: _this8.d.run.highest_cleared,
              damage: _this8.number(_this8.b.currentStats.baseline * 30)
            });
          }, p, 'info');
          u.button('BossAction', 12, 132, 336, 52, function () {
            return _this8.t(_this8.d.run.mode === 'boss' ? 'boss.withdraw' : 'boss.retry');
          }, function () {
            _this8.session.tick();
            if (_this8.d.run.mode === 'boss') _this8.session.withdraw();else if (_this8.session.retry() !== 'OK') _this8.toast('boss.unavailable');
          }, p, function () {
            return _this8.d.run.mode === 'boss' || _this8.d.run.mode === 'farming' && _this8.d.run.frontier > _this8.d.run.highest_cleared;
          });
          u.button('AutoRetry', 12, 196, 336, 48, function () {
            return _this8.t(_this8.d.supports.auto_retry ? 'retry.on' : 'retry.off');
          }, function () {
            _this8.d.supports.auto_retry = !_this8.d.supports.auto_retry;
            _this8.session.save();
          }, p, function () {
            return true;
          }, true);
          u.text('operations.hint', 12, 254, 336, 80, 13, p, 'info');
          u.text('operations.pone', 12, 348, 336, 60, 14, p);
          u.button('OpenSettings', 12, 420, 336, 48, function () {
            return _this8.t('settings.title');
          }, function () {
            return _this8.settings();
          }, p, function () {
            return true;
          }, true);
          if (this.d.test_profile) {
            u.text('test.warning', 12, 480, 336, 54, 13, p, 'action');
            u.button('TestBoss', 12, 546, 162, 48, function () {
              return _this8.t('test.boss');
            }, function () {
              _this8.session.testBoss();
            }, p);
            u.button('TestGold', 186, 546, 162, 48, function () {
              return _this8.t('test.gold');
            }, function () {
              _this8.d.run.gold = String(Number(_this8.d.run.gold) + 10000);
              _this8.session.save();
            }, p);
          }
        };
        _proto.placeholder = function placeholder(tab, p) {
          var _this9 = this;
          var u = this.ui;
          var subtabs = tab === 'armory' ? ['weapons', 'tactical', 'radio', 'dogtag'] : tab === 'squad' ? ['deploy', 'train', 'collection'] : ['draw', 'shop', 'free'];
          subtabs.forEach(function (id, i) {
            return u.button(tab + '.sub.' + id, 8 + i * (344 / subtabs.length), 0, 340 / subtabs.length, 48, function () {
              return _this9.t('sub.' + id);
            }, function () {
              _this9.d.ui.tabs[tab].sub = i;
              _this9.session.save();
              _this9.info('sub.' + id, 'phase.' + tab);
            }, p, function () {
              return _this9.d.ui.tabs[tab].sub === i;
            }, true);
          });
          u.text('content.' + tab, 16, 70, 328, 56, 22, p);
          u.text('phase.' + tab, 16, 144, 328, 112, 15, p, 'info');
          u.label('Parts.' + tab, 16, 268, 328, 42, 15, function () {
            return _this9.t('resource.parts', {
              value: _this9.number(Number(_this9.d.wallet.parts))
            });
          }, p, 'action');
          u.text('placeholder.hint', 16, 340, 328, 85, 13, p, 'info');
          if (tab === 'armory') u.text('weapon.pistol', 16, 440, 328, 70, 15, p);
        };
        _proto.changeTab = function changeTab(tab, record) {
          var _this$scrolls$get;
          if (record === void 0) {
            record = true;
          }
          if (!tabs.includes(tab)) return;
          var old = this.d.ui.tab;
          var oldScroll = this.scrolls.get(old);
          if (record && oldScroll) this.d.ui.tabs[old].scroll = Math.max(0, oldScroll.getScrollOffset().y);
          this.session.selectTab(tab);
          for (var _iterator = _createForOfIteratorHelperLoose(this.panels), _step; !(_step = _iterator()).done;) {
            var _step$value = _step.value,
              id = _step$value[0],
              n = _step$value[1];
            n.active = id === tab;
          }
          (_this$scrolls$get = this.scrolls.get(tab)) == null || _this$scrolls$get.scrollToOffset(new Vec2(0, this.d.ui.tabs[tab].scroll), 0);
          this.ui.refresh();
        };
        _proto.sheet = function sheet(title, body) {
          var _this10 = this;
          this.close();
          var u = this.ui;
          var modal = u.box('ModalDim', 0, 0, 360, this.height, '#00000080');
          u.blocker(modal);
          this.popup = modal;
          var y = Math.max(this.panelTop - 8, this.height - 330);
          var panel = u.box('ModalPanel', 12, y, 336, 290, 'panel', modal, 'border');
          u.text(title, 16, 10, 304, 40, 20, panel);
          u.text(body, 16, 59, 304, 136, 14, panel, 'info');
          u.button('ModalClose', 16, 223, 304, 50, function () {
            return _this10.t('common.close');
          }, function () {
            return _this10.close();
          }, panel, function () {
            return true;
          }, true);
          return panel;
        };
        _proto.info = function info(title, body) {
          this.sheet(title, body);
        };
        _proto.close = function close() {
          if (this.popup) {
            this.popup.destroy();
            this.popup = null;
          }
        };
        _proto.settings = function settings() {
          var _this11 = this;
          var panel = this.sheet('settings.title', 'settings.body');
          var u = this.ui;
          var logo = u.group('CompanyCI', 242, 12, panel, 72, 36).addComponent(Sprite);
          logo.sizeMode = Sprite.SizeMode.CUSTOM;
          resources.load('branding/tt-softs-ci/texture', Texture2D, function (error, texture) {
            if (error || !logo.isValid) return;
            var frame = new SpriteFrame();
            frame.texture = texture;
            logo.spriteFrame = frame;
          });
          // Settings controls occupy the body area; explanatory text is kept in the header.
          var body = panel.getChildByName('settings.body');
          if (body) body.active = false;
          u.button('Language', 16, 56, 304, 45, function () {
            return _this11.t('settings.language');
          }, function () {
            _this11.d.ui.locale = _this11.d.ui.locale === 'ko' ? 'en' : 'ko';
            _this11.session.save();
            if (typeof document !== 'undefined') document.title = _this11.t('app.title');
            u.refresh();
          }, panel, function () {
            return true;
          }, true);
          u.button('ReducedFX', 16, 108, 304, 45, function () {
            return _this11.t(_this11.d.ui.reduced_fx ? 'settings.fx.reduced' : 'settings.fx.full');
          }, function () {
            _this11.d.ui.reduced_fx = !_this11.d.ui.reduced_fx;
            _this11.session.save();
          }, panel, function () {
            return true;
          }, true);
          u.label('SaveStatus', 16, 163, 304, 43, 11, function () {
            return _this11.t(_this11.session.saveError ? 'save.failed' : 'save.local');
          }, panel, 'info');
        };
        _proto.hide = function hide() {
          var _this$session;
          (_this$session = this.session) == null || _this$session.suspend();
        };
        _proto.show = function show() {
          var _this$session2;
          (_this$session2 = this.session) == null || _this$session2.resume();
        };
        _proto.update = function update(dt) {
          var _this12 = this;
          if (!this.session) return;
          this.session.tick();
          this.battleView.render(this.b);
          this.elapsed += dt;
          if (this.elapsed >= .1) {
            this.elapsed = 0;
            this.ui.refresh();
          }
          var failure = this.b.lastFailure;
          if (failure && failure !== this.failureSeen) {
            this.failureSeen = failure;
            var panel = this.sheet('boss.failed', 'boss.failed.body');
            this.ui.label('Remaining', 16, 168, 304, 38, 14, function () {
              return _this12.t('boss.remaining', {
                percent: (failure.remaining * 100).toFixed(1),
                stage: _this12.d.run.farming
              });
            }, panel, 'action');
          }
        };
        _proto.onDestroy = function onDestroy() {
          var _this$session3;
          game.off(Game.EVENT_HIDE, this.hide, this);
          game.off(Game.EVENT_SHOW, this.show, this);
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
          if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.pagehide);
          (_this$session3 = this.session) == null || _this$session3.save();
        };
        _createClass(ProjectBootstrap, [{
          key: "b",
          get: function get() {
            return this.session.battle;
          }
        }, {
          key: "d",
          get: function get() {
            return this.session.data;
          }
        }]);
        return ProjectBootstrap;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/SaveStore.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports('validateSave', validateSave);
      cclegacy._RF.push({}, "2d1df6S8/pOVa2nRNe/NNXz", "SaveStore", undefined);
      function validateSave(value, c) {
        var d = value;
        if (!d || d.schema_version !== c.persistence.schema_version || d.config_version !== c.config_version) throw Error('SAVE_CORRUPT');
        var _int = function _int(n, min, max) {
          if (min === void 0) {
            min = 0;
          }
          if (max === void 0) {
            max = Number.MAX_SAFE_INTEGER;
          }
          if (!Number.isSafeInteger(n) || n < min || n > max) throw Error('SAVE_CORRUPT');
        };
        var money = function money(s) {
          if (typeof s !== 'string' || !s.trim() || !Number.isFinite(Number(s)) || Number(s) < 0) throw Error('SAVE_CORRUPT');
        };
        _int(d.revision);
        _int(d.serial);
        _int(d.rng, 0, 4294967295);
        if (!Number.isFinite(d.saved_at) || d.saved_at < 0) throw Error('SAVE_CORRUPT');
        if (typeof d.run_id !== 'string' || typeof d.test_profile !== 'boolean') throw Error('SAVE_CORRUPT');
        for (var _iterator = _createForOfIteratorHelperLoose(['frontier', 'farming', 'highest_reached']), _step; !(_step = _iterator()).done;) {
          var _k = _step.value;
          _int(d.run[_k], 1, 50);
        }
        if (d.run.retry_at !== undefined && (!Number.isFinite(d.run.retry_at) || d.run.retry_at < 0)) throw Error('SAVE_CORRUPT');
        _int(d.run.highest_cleared, 0, 50);
        _int(d.run.normal_kills, 0, 5);
        _int(d.account.highest_reached, 1, 50);
        _int(d.account.highest_cleared, 0, 50);
        if (!['normal', 'farming', 'boss'].includes(d.run.mode) || d.run.highest_cleared > d.run.highest_reached || d.run.frontier > d.run.highest_reached) throw Error('SAVE_CORRUPT');
        money(d.run.gold);
        for (var _iterator2 = _createForOfIteratorHelperLoose(['parts', 'medals', 'gems']), _step2; !(_step2 = _iterator2()).done;) {
          var key = _step2.value;
          money(d.wallet[key]);
          if (!Number.isInteger(Number(d.wallet[key]))) throw Error('SAVE_CORRUPT');
        }
        for (var _i = 0, _arr = [d.supports.auto, d.supports.auto_retry, d.run.boss_nuke_used, d.ui.reduced_fx, d.clock_suspect]; _i < _arr.length; _i++) {
          var flag = _arr[_i];
          if (typeof flag !== 'boolean') throw Error('SAVE_CORRUPT');
        }
        _int(d.account.prestige_count);
        for (var _iterator3 = _createForOfIteratorHelperLoose(d.account.first_boss), _step3; !(_step3 = _iterator3()).done;) {
          var stage = _step3.value;
          _int(stage, 5, 50);
        }
        for (var _iterator4 = _createForOfIteratorHelperLoose(['attack', 'rapid', 'critical']), _step4; !(_step4 = _iterator4()).done;) {
          var _c$training$stat$max_;
          var stat = _step4.value;
          _int(d.run.training[stat], 0, (_c$training$stat$max_ = c.training[stat].max_level) != null ? _c$training$stat$max_ : 10000);
        }
        for (var _iterator5 = _createForOfIteratorHelperLoose(c.supports), _step5; !(_step5 = _iterator5()).done;) {
          var s = _step5.value;
          if (!Number.isFinite(d.supports.ready_at[s.id]) || d.supports.ready_at[s.id] < 0 || !['auto', 'boss_only', 'manual'].includes(d.supports.policies[s.id])) throw Error('SAVE_CORRUPT');
        }
        for (var _i2 = 0, _arr2 = [d.supports.presets.farming, d.supports.presets.boss]; _i2 < _arr2.length; _i2++) {
          var preset = _arr2[_i2];
          if (preset.length !== 4 || new Set(preset.filter(Boolean)).size !== preset.filter(Boolean).length || preset.some(function (id) {
            return id !== null && !c.supports.some(function (s) {
              return s.id === id;
            });
          })) throw Error('SAVE_CORRUPT');
        }
        if (!['ko', 'en'].includes(d.ui.locale) || !d.ui.tabs[d.ui.tab] || typeof d.mission.claimed !== 'boolean' || !Array.isArray(d.account.first_boss)) throw Error('SAVE_CORRUPT');
        for (var _iterator6 = _createForOfIteratorHelperLoose(['hero', 'armory', 'support', 'squad', 'operations', 'supply']), _step6; !(_step6 = _iterator6()).done;) {
          var id = _step6.value;
          var t = d.ui.tabs[id];
          if (!t || !Number.isFinite(t.scroll) || t.scroll < 0 || ![1, 10, 'max'].includes(t.bulk)) throw Error('SAVE_CORRUPT');
          _int(t.sub);
        }
        if (d.requests) {
          if (typeof d.requests !== 'object' || Array.isArray(d.requests)) throw Error('SAVE_CORRUPT');
          for (var _i3 = 0, _Object$values = Object.values(d.requests); _i3 < _Object$values.length; _i3++) {
            var entry = _Object$values[_i3];
            if (typeof entry.fingerprint !== 'string' || typeof entry.result.code !== 'string') throw Error('SAVE_CORRUPT');
            _int(entry.result.revision);
            for (var _i4 = 0, _Object$values2 = Object.values(entry.result.balances); _i4 < _Object$values2.length; _i4++) {
              var _value = _Object$values2[_i4];
              money(_value);
            }
          }
        }
        _int(d.mission.trained);
        return d;
      }
      var SaveStore = exports('SaveStore', /*#__PURE__*/function () {
        function SaveStore(storage, config, test) {
          if (test === void 0) {
            test = false;
          }
          this.key = void 0;
          this.storage = storage;
          this.config = config;
          this.key = test ? 'armyGirl.p0.test' : 'armyGirl.p0';
        }
        var _proto = SaveStore.prototype;
        _proto.parse = function parse(raw) {
          return validateSave(JSON.parse(raw), this.config);
        };
        _proto.load = function load() {
          var main = this.storage.getItem(this.key),
            backup = this.storage.getItem(this.key + '.backup');
          if (main === null && backup === null) return {
            data: null,
            recovered: false
          };
          if (main !== null) try {
            return {
              data: this.parse(main),
              recovered: false
            };
          } catch (_unused) {}
          if (backup !== null) try {
            return {
              data: this.parse(backup),
              recovered: true
            };
          } catch (_unused2) {}
          throw Error('SAVE_CORRUPT');
        };
        _proto.write = function write(d) {
          var raw = JSON.stringify(d);
          this.parse(raw);
          this.storage.setItem(this.key + '.pending', raw);
          this.parse(this.storage.getItem(this.key + '.pending'));
          var old = this.storage.getItem(this.key);
          if (old !== null) try {
            this.parse(old);
            this.storage.setItem(this.key + '.backup', old);
          } catch (_unused3) {}
          // Web Storage setItem replaces a single value atomically. Never replace the backup with corrupt data.
          this.storage.setItem(this.key, raw);
          if (!this.storage.getItem(this.key + '.backup')) this.storage.setItem(this.key + '.backup', raw);
          this.storage.removeItem(this.key + '.pending');
        };
        return SaveStore;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Widgets.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Color, Node, Layers, UITransform, Graphics, Label, BlockInputEvents;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Node = module.Node;
      Layers = module.Layers;
      UITransform = module.UITransform;
      Graphics = module.Graphics;
      Label = module.Label;
      BlockInputEvents = module.BlockInputEvents;
    }],
    execute: function () {
      cclegacy._RF.push({}, "47c2bWQQjJLd5SHThZ8Xgz3", "Widgets", undefined);
      var Widgets = exports('Widgets', /*#__PURE__*/function () {
        function Widgets(root, tables, locale, tokens) {
          this.bindings = [];
          this.root = root;
          this.tables = tables;
          this.locale = locale;
          this.tokens = tokens;
        }
        var _proto = Widgets.prototype;
        _proto.t = function t(key, args) {
          if (args === void 0) {
            args = {};
          }
          var s = this.tables[this.locale()][key];
          if (!s) throw Error("Missing localization: " + key);
          return s.replace(/\{(\w+)\}/g, function (_, n) {
            var _args$n;
            return String((_args$n = args[n]) != null ? _args$n : "{" + n + "}");
          });
        };
        _proto.color = function color(token) {
          return new Color(this.tokens[token] || token);
        };
        _proto.group = function group(name, x, y, parent, w, h) {
          if (x === void 0) {
            x = 0;
          }
          if (y === void 0) {
            y = 0;
          }
          if (parent === void 0) {
            parent = this.root;
          }
          if (w === void 0) {
            w = 360;
          }
          if (h === void 0) {
            h = 800;
          }
          var n = new Node(name);
          n.layer = Layers.Enum.UI_2D;
          n.parent = parent;
          n.setPosition(x, -y);
          var tr = n.addComponent(UITransform);
          tr.setAnchorPoint(0, 1);
          tr.setContentSize(w, h);
          return n;
        };
        _proto.box = function box(name, x, y, w, h, fill, parent, border) {
          if (parent === void 0) {
            parent = this.root;
          }
          var n = this.group(name, x, y, parent, w, h);
          var g = n.addComponent(Graphics);
          g.fillColor = this.color(fill);
          g.rect(0, -h, w, h);
          g.fill();
          if (border) {
            g.strokeColor = this.color(border);
            g.lineWidth = 1;
            g.rect(.5, -h + .5, w - 1, h - 1);
            g.stroke();
          }
          return n;
        };
        _proto.label = function label(name, x, y, w, h, size, value, parent, color, center) {
          if (parent === void 0) {
            parent = this.root;
          }
          if (color === void 0) {
            color = 'text';
          }
          if (center === void 0) {
            center = false;
          }
          var n = this.group(name, x, y, parent, w, h);
          var l = n.addComponent(Label);
          l.fontSize = size;
          l.lineHeight = size + 5;
          l.color = this.color(color);
          l.overflow = Label.Overflow.SHRINK;
          l.enableWrapText = true;
          l.horizontalAlign = center ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
          l.verticalAlign = Label.VerticalAlign.CENTER;
          var bind = function bind() {
            if (n.isValid) l.string = value();
          };
          this.bindings.push({
            node: n,
            update: bind
          });
          bind();
          return l;
        };
        _proto.text = function text(key, x, y, w, h, size, parent, color) {
          var _this = this;
          if (size === void 0) {
            size = 14;
          }
          if (parent === void 0) {
            parent = this.root;
          }
          if (color === void 0) {
            color = 'text';
          }
          return this.label(key, x, y, w, h, size, function () {
            return _this.t(key);
          }, parent, color);
        };
        _proto.button = function button(name, x, y, w, h, value, action, parent, enabled, secondary) {
          var _this2 = this;
          if (parent === void 0) {
            parent = this.root;
          }
          if (enabled === void 0) {
            enabled = function enabled() {
              return true;
            };
          }
          if (secondary === void 0) {
            secondary = false;
          }
          var n = this.box(name, x, y, w, h, secondary ? 'card' : 'action', parent, 'border');
          var g = n.getComponent(Graphics);
          var label = this.label(name + '.label', 5, 0, w - 10, h, 13, value, n, secondary ? 'text' : 'background', true);
          this.bindings.push({
            node: n,
            update: function update() {
              label.color = _this2.color(secondary ? 'text' : enabled() ? 'background' : 'info');
            }
          });
          n.on(Node.EventType.TOUCH_END, function () {
            return action();
          });
          this.bindings.push({
            node: n,
            update: function update() {
              if (!n.isValid) return;
              g.clear();
              g.fillColor = _this2.color(enabled() ? secondary ? 'card' : 'action' : 'background');
              g.rect(0, -h, w, h);
              g.fill();
              g.strokeColor = _this2.color(enabled() ? 'border' : 'panel');
              g.lineWidth = 1;
              g.rect(.5, -h + .5, w - 1, h - 1);
              g.stroke();
              g.fillColor = _this2.color(enabled() && !secondary ? '#FFDB96' : 'border');
              g.rect(1, -3, w - 2, 2);
              g.fill();
            }
          });
          return n;
        };
        _proto.meter = function meter(name, x, y, width, height, value, parent) {
          var _this3 = this;
          var n = this.group(name, x, y, parent, width, height);
          var g = n.addComponent(Graphics);
          this.bindings.push({
            node: n,
            update: function update() {
              g.clear();
              g.fillColor = _this3.color('background');
              g.rect(0, -height, width, height);
              g.fill();
              g.fillColor = _this3.color('action');
              g.rect(0, -height, width * Math.max(0, Math.min(1, value())), height);
              g.fill();
            }
          });
        }
        /** Original code-drawn pixel pictograms; no reference-game assets. */;
        _proto.icon = function icon(id, x, y, size, parent, color) {
          var _this4 = this;
          var patterns = {
            hero: ['00111100', '00111100', '00011000', '01111110', '11111111', '10111101', '00100100', '01100110'],
            armory: ['00000000', '11111111', '11111111', '00111000', '00110000', '00110000', '00000000', '00000000'],
            support: ['00011000', '00011100', '00111100', '01111110', '01111110', '01111110', '00111100', '00000000'],
            squad: ['01100110', '01100110', '00000000', '11111111', '11111111', '01011010', '01011010', '00000000'],
            operations: ['11000000', '11111110', '11111110', '11111100', '11000000', '11000000', '11000000', '11110000'],
            supply: ['00011000', '01111110', '11111111', '10011001', '11111111', '10011001', '11111111', '00000000'],
            rapid: ['01100110', '00110011', '00011001', '00110011', '01100110', '00000000', '11111111', '00000000'],
            critical: ['00011000', '00111100', '01011010', '11111111', '11111111', '01011010', '00111100', '00011000'],
            lock: ['00111100', '01100110', '01100110', '11111111', '11100111', '11100111', '11111111', '00000000'],
            plus: ['00000000', '00011000', '00011000', '01111110', '01111110', '00011000', '00011000', '00000000'],
            missile: ['00011000', '00111100', '00111100', '00111100', '01111110', '11011011', '00011000', '00011000'],
            nuke: ['00011000', '00011000', '10011001', '11000011', '11100111', '00000000', '00111100', '01111110'],
            adrenaline: ['00011000', '00011000', '00011000', '11111111', '11111111', '00011000', '00011000', '00011000'],
            gold: ['00111100', '01111110', '11011011', '11011011', '11011011', '11011011', '01111110', '00111100']
          };
          var aliases = {
            attack: 'armory',
            grenade: 'support',
            mortar: 'missile',
            tank: 'armory',
            recon_drone: 'critical',
            airstrike: 'missile'
          };
          var n = this.group('Icon', x, y, parent, size, size);
          var g = n.addComponent(Graphics);
          this.bindings.push({
            node: n,
            update: function update() {
              var key = typeof id === 'string' ? id : id();
              var token = color();
              var rows = patterns[aliases[key] || key] || patterns.support;
              var unit = size / 8;
              g.clear();
              g.fillColor = _this4.color(token);
              rows.forEach(function (row, iy) {
                return row.split('').forEach(function (pixel, ix) {
                  if (pixel === '1') {
                    g.rect(ix * unit, -(iy + 1) * unit, unit, unit);
                    g.fill();
                  }
                });
              });
              g.fill();
            }
          });
        };
        _proto.refresh = function refresh() {
          this.bindings = this.bindings.filter(function (b) {
            return b.node.isValid;
          });
          for (var _iterator = _createForOfIteratorHelperLoose(this.bindings), _step; !(_step = _iterator()).done;) {
            var b = _step.value;
            b.update();
          }
        };
        _proto.blocker = function blocker(n) {
          n.addComponent(BlockInputEvents);
        };
        return Widgets;
      }());
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});
//# sourceMappingURL=index.js.map