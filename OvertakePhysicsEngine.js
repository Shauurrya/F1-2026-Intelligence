'use strict';
/* ═══════════════════════════════════════════════════════════════
   OVERTAKE PHYSICS ENGINE — OvertakePhysicsEngine.js
   
   Models real overtake mechanics including:
   - DRS activation zones with speed differential calculation
   - Dirty air aerodynamic penalty modeling
   - Slipstream effect on straights
   - Braking zone overtake probability
   - Position-specific overtake difficulty (harder to pass P1 than P15)
   - Gap dynamics (closing/opening rate per lap)
   
   Feeds into MarkovLapSimulator for per-lap overtake resolution.
   ═══════════════════════════════════════════════════════════════ */

window.OvertakePhysicsEngine = (() => {

    // ─────────────────────────────────────────────────────────────
    // DRS PHYSICS MODEL
    // ─────────────────────────────────────────────────────────────
    const DRS = {
        activationGap: 1.0,         // seconds — must be within 1s to activate
        speedBoostKmh: 12,          // typical DRS speed advantage
        straightSpeedBase: 330,     // km/h base straight line speed
        overtakeWindowMs: 400,      // milliseconds where overtake is possible per zone

        /**
         * Calculate DRS-assisted overtake probability
         * @param {number} gap - Gap in seconds to car ahead
         * @param {number} paceDelta - Lap time difference (positive = attacker faster)
         * @param {number} zones - Number of DRS zones on track
         * @param {number} attackerStraightSpeed - Attacker's top speed rating 0-1
         * @param {number} defenderStraightSpeed - Defender's top speed rating 0-1
         */
        calculateDRSEffect(gap, paceDelta, zones, attackerSpeed, defenderSpeed) {
            if (gap > this.activationGap || gap <= 0) {
                return { active: false, probability: 0, speedDelta: 0 };
            }

            const attackerV = this.straightSpeedBase + this.speedBoostKmh + (attackerSpeed || 0.5) * 15;
            const defenderV = this.straightSpeedBase + (defenderSpeed || 0.5) * 15;
            const speedDelta = attackerV - defenderV; // km/h advantage

            // Probability scales with speed delta and number of zones
            let baseProbPerZone = 0.0;
            if (speedDelta > 0) {
                baseProbPerZone = Math.min(0.25, speedDelta / 80); // 20 km/h delta ≈ 25% per zone
            } else {
                baseProbPerZone = 0.02; // very small chance even with slower speed (dive bomb)
            }

            // Gap proximity bonus (closer = easier to complete overtake)
            const gapBonus = Math.max(0, (1 - gap) * 0.15); // bonus up to 15% when very close

            const totalProb = Math.min(0.55, baseProbPerZone * zones + gapBonus);

            return {
                active: true,
                probability: totalProb,
                speedDelta,
                zones,
            };
        }
    };

    // ─────────────────────────────────────────────────────────────
    // DIRTY AIR MODEL
    // ─────────────────────────────────────────────────────────────
    const DirtyAir = {
        maxEffect: 0.35,        // seconds lost per lap in worst dirty air
        falloffStart: 0.5,      // gap in seconds where dirty air starts
        falloffEnd: 2.5,        // gap where dirty air becomes negligible

        /**
         * Calculate dirty air time loss
         * @param {number} gap - Gap to car ahead in seconds
         * @returns {number} Time lost in seconds
         */
        calculatePenalty(gap) {
            if (gap >= this.falloffEnd || gap <= 0) return 0;
            if (gap <= this.falloffStart) return this.maxEffect;

            // Linear falloff between start and end
            const ratio = (gap - this.falloffStart) / (this.falloffEnd - this.falloffStart);
            return this.maxEffect * (1 - ratio);
        },

        /**
         * Calculate how dirty air affects following car's cornering
         * Returns a grip multiplier (< 1.0 means reduced grip)
         */
        getGripModifier(gap) {
            const timeLoss = this.calculatePenalty(gap);
            return 1.0 - (timeLoss * 0.4); // Convert time loss to grip reduction
        }
    };

    // ─────────────────────────────────────────────────────────────
    // SLIPSTREAM MODEL
    // ─────────────────────────────────────────────────────────────
    const Slipstream = {
        maxBenefit: 0.20,       // seconds gained per lap from slipstream
        activeRange: 1.5,       // seconds gap for slipstream to work
        peakRange: 0.8,         // gap where slipstream is strongest

        /**
         * Calculate slipstream benefit (offset to dirty air on straights)
         */
        calculateBenefit(gap) {
            if (gap > this.activeRange || gap <= 0) return 0;
            if (gap <= this.peakRange) {
                return this.maxBenefit * (gap / this.peakRange); // linearly increases approaching from behind
            }
            // Falloff past peak
            const ratio = (gap - this.peakRange) / (this.activeRange - this.peakRange);
            return this.maxBenefit * (1 - ratio);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // GAP DYNAMICS
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate how gap changes between two cars over one lap
     * @param {number} currentGap - Current gap in seconds
     * @param {number} paceDelta - Pace difference (positive = following car faster)
     * @param {string} weather - 'dry' | 'wet' | 'mixed'
     * @returns {number} New gap after one lap
     */
    function calculateGapDelta(currentGap, paceDelta, weather) {
        let gapChange = paceDelta; // faster car closes the gap

        // Dirty air slows the following car
        const dirtyAirLoss = DirtyAir.calculatePenalty(currentGap);
        gapChange -= dirtyAirLoss;

        // Slipstream helps on straights
        const slipstreamGain = Slipstream.calculateBenefit(currentGap);
        gapChange += slipstreamGain;

        // Weather affects gap dynamics
        if (weather === 'wet') gapChange *= 1.3; // bigger lap time swings in wet
        if (weather === 'mixed') gapChange *= 1.15;

        return currentGap - gapChange;
    }

    // ─────────────────────────────────────────────────────────────
    // MASTER OVERTAKE PROBABILITY
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate comprehensive overtake probability using all physics models
     * @param {Object} params
     * @returns {number} Probability 0-1
     */
    function calculateOvertakeProbability(params) {
        const {
            paceDelta = 0,
            gap = 999,
            drsActive = false,
            drsZones = 1,
            trackDifficulty = 0.4,
            weather = 'dry',
            tireDelta = 0,        // positive = attacker has fresher tires
            lapsRemaining = 30,
            attackerAggression = 0.5,
            positionFighting = 10,  // which position we're fighting for (1=lead, 22=last)
        } = params;

        let prob = 0;

        // 1. Pace-based overtaking
        if (paceDelta > 0) {
            prob += Math.min(0.20, paceDelta * 1.8);
        }

        // 2. DRS physics
        if (drsActive && gap < DRS.activationGap) {
            const drsResult = DRS.calculateDRSEffect(gap, paceDelta, drsZones, 0.5, 0.5);
            prob += drsResult.probability;
        }

        // 3. Gap proximity — closer = more attempts possible
        if (gap < 0.5) prob += 0.10;
        else if (gap < 1.0) prob += 0.05;

        // 4. Track difficulty penalty
        prob *= (1 - trackDifficulty * 0.7);

        // 5. Tire advantage (check larger delta first)
        if (tireDelta > 10) prob += 0.15;
        else if (tireDelta > 5) prob += 0.08;

        // 6. Weather modifier — wet makes overtaking riskier but rewards bravery
        if (weather === 'wet') prob *= 0.7;
        if (weather === 'mixed') prob *= 0.85; // mixed = transitions create opportunities

        // 7. Position importance — harder to pass for lead than midfield
        if (positionFighting <= 3) prob *= 0.85;  // top 3 defend harder
        if (positionFighting >= 15) prob *= 1.10; // backmarkers less defensive

        // 8. Driver aggression
        prob *= (0.7 + attackerAggression * 0.6);

        // 9. Late-race desperation bonus
        if (lapsRemaining < 10) prob *= 1.15;
        if (lapsRemaining < 3) prob *= 1.25;

        return Math.max(0.005, Math.min(0.65, prob));
    }

    // ─────────────────────────────────────────────────────────────
    // BATTLE INTENSITY TRACKER
    // Tracks which driver pairs are in active battles
    // ─────────────────────────────────────────────────────────────
    const _battles = {};

    function trackBattle(driver1Id, driver2Id, gap) {
        const key = [driver1Id, driver2Id].sort().join('_');
        if (!_battles[key]) {
            _battles[key] = { lapsInBattle: 0, overtakes: 0, closest: gap };
        }
        _battles[key].lapsInBattle++;
        _battles[key].closest = Math.min(_battles[key].closest, gap);
        return _battles[key];
    }

    function getBattles() { return { ..._battles }; }
    function clearBattles() { Object.keys(_battles).forEach(k => delete _battles[k]); }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────
    return {
        calculateOvertakeProbability,
        calculateGapDelta,
        DRS,
        DirtyAir,
        Slipstream,
        trackBattle,
        getBattles,
        clearBattles,
    };
})();

console.log('%c[OvertakePhysicsEngine] Ready — DRS zones + dirty air + slipstream + gap dynamics', 'color:#06b6d4;font-weight:bold');
