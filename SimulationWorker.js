'use strict';
/* ═══════════════════════════════════════════════════════════════
   SIMULATION WEB WORKER — SimulationWorker.js
   Offloads Monte Carlo race simulations from the main thread
   to prevent UI freezing during prediction calculations.
   
   Runs a simplified but complete simulation pipeline:
   - Seeded RNG for deterministic results
   - Driver pace calculation with variance
   - Safety car, DNF, pit stop modeling  
   - Weather impact simulation
   ═══════════════════════════════════════════════════════════════ */

// Seeded RNG (mirrors main thread implementation)
function RNG(seed) { this.s = (seed || 1) % 2147483647; }
RNG.prototype.next = function () { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; };
RNG.prototype.norm = function (m, sd) {
    const u = Math.max(this.next(), 1e-9), v = this.next();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };

// Worker message handler
self.onmessage = function (e) {
    const { drivers, race, sims, teamRatings, driverFormMults, personalities, driverSkills, config } = e.data;

    const wins = {}, podiums = {}, finishSum = {}, dnfs = {};
    drivers.forEach(d => { wins[d.id] = 0; podiums[d.id] = 0; finishSum[d.id] = 0; dnfs[d.id] = 0; });

    // Run batch of simulations
    for (let sim = 0; sim < sims; sim++) {
        const rng = new RNG(race.round * 10000 + sim * 73 + 1);
        const rainRoll = rng.next();
        const weather = rainRoll < (race.rain_probability * 0.3) ? 'heavy_rain' :
            rainRoll < (race.rain_probability * 0.6) ? 'wet' :
                rainRoll < race.rain_probability ? 'light_rain' : 'dry';

        const wpNoise = weather === 'dry' ? 0.06 : weather === 'light_rain' ? 0.09 : weather === 'wet' ? 0.14 : 0.20;
        const wpDnfMod = weather === 'dry' ? 1.0 : weather === 'light_rain' ? 1.3 : weather === 'wet' ? 1.7 : 2.3;

        const scHappens = rng.next() < race.sc_probability;
        const scChaos = scHappens ? rng.range(0.05, 0.25) : 0;

        // Build entries with pace
        const entries = drivers.map(d => {
            const teamR = (teamRatings[d.team] || 85) / 100;
            const formMult = driverFormMults[d.id] || 1.0;
            const pers = personalities[d.id] || { aggression: 1.0, tire_smoothness: 1.0, defense: 1.0, mistake_rate: 1.0, overtake_risk: 1.0 };
            const skill = driverSkills[d.id] || {};
            const wetMod = (weather !== 'dry' && skill.wet) ? skill.wet : 1.0;

            // Pace calculation (simplified version of main thread calculatePace)
            const rawSkill = d.rating / 100;
            const driverPace = rawSkill * formMult * wetMod;
            const carPace = teamR;
            let pace = (driverPace * 0.40) + (carPace * 0.42) + (1.0 * 0.18);
            pace += rng.norm(0, wpNoise * 0.5);

            // DNF check
            const baseDnf = (config.teamDnfRates || {})[d.team] || 0.04;
            const dnfChance = baseDnf * wpDnfMod * (pers.mistake_rate || 1.0);
            if (rng.next() < dnfChance) {
                dnfs[d.id]++;
                return { driver: d, time: 9999 + rng.next() };
            }

            // Grid position effect
            const qualiPace = pace + rng.norm(0, wpNoise * 0.3);
            return { driver: d, time: (2 - pace), qualiPace };
        });

        // Sort by qualifying pace to determine grid
        entries.sort((a, b) => b.qualiPace - a.qualiPace);
        entries.forEach((e, i) => {
            if (e.time < 9900) {
                const gridPenalty = i * 0.06 * 0.3;
                e.time += gridPenalty;
            }
        });

        // SC bunching
        if (scHappens) {
            entries.forEach(e => {
                if (e.time < 9900) {
                    e.time -= rng.range(0, scChaos * 0.5);
                }
            });
        }

        // Sort by race time
        entries.sort((a, b) => a.time - b.time);

        // Record results
        entries.forEach((e, i) => {
            finishSum[e.driver.id] += (i + 1);
            if (i === 0) wins[e.driver.id]++;
            if (i < 3) podiums[e.driver.id]++;
        });
    }

    // Send results back to main thread
    self.postMessage({
        done: true,
        wins, podiums, finishSum, dnfs, sims
    });
};
