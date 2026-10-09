/* Dev-only fallbacks. Each block runs ONLY if the real plan.js / figures.js did not load. */
if (!window.PLAN) {
  window.PLAN = {
    startDate: "2026-10-09", tripDate: "2026-10-22", dayNumberOffset: 2,
    exercises: {
      treadmill: { name: "Treadmill walk", equipment: "Treadmill", target: "Cardio", cues: ["Brisk pace, slight incline", "Don't hold the rails"], backSafety: "Stand tall; no leaning on the rails." },
      catcow: { name: "Cat-cow", equipment: "Mat", target: "Spine mobility", cues: ["On all fours", "Arch slowly, then round"], backSafety: "Move only in a pain-free range." },
      deadbug: { name: "Dead bug", equipment: "Mat", target: "Core", cues: ["Low back pressed to floor", "Opposite arm and leg"], backSafety: "If your back lifts off the floor, shorten the reach." },
      gobletsquat: { name: "Goblet squat", equipment: "Dumbbell", target: "Legs", cues: ["Hold DB at chest", "Sit between heels", "Drive up through mid-foot"], backSafety: "Keep the chest up and spine neutral; stop above pain." },
      row: { name: "One-arm DB row", equipment: "Dumbbell + bench", target: "Upper back", cues: ["Hand and knee on bench", "Pull elbow to hip"], backSafety: "Flat back, no twisting." },
      plank: { name: "Front plank", equipment: "Mat", target: "Core", cues: ["Elbows under shoulders", "Squeeze glutes"], backSafety: "Don't let hips sag." },
      childpose: { name: "Child's pose", equipment: "Mat", target: "Back stretch", cues: ["Sit back on heels", "Breathe slowly"], backSafety: "Gentle; no bouncing." }
    },
    days: [
      { date: "2026-10-09", dayNumber: 3, title: "Full body reboot", focus: "Legs, back & core", type: "workout",
        tip: "Leave 2 reps in the tank on every set. You're rebuilding, not testing.",
        blocks: [
          { name: "Treadmill", durationMin: 10, items: [{ id: "treadmill", sets: 1, reps: "1 km", restSec: 0, note: "5.5 km/h, incline 2" }] },
          { name: "Warm-up", durationMin: 5, items: [{ id: "catcow", sets: 1, reps: "10", restSec: 15, note: "" }, { id: "deadbug", sets: 2, reps: "8/side", restSec: 20, note: "Slow" }] },
          { name: "Main", durationMin: 30, items: [{ id: "gobletsquat", sets: 3, reps: "12", restSec: 60, note: "Start light: 10-12 kg" }, { id: "row", sets: 3, reps: "10/side", restSec: 45, note: "" }] },
          { name: "Finisher", durationMin: 5, items: [{ id: "plank", sets: 2, reps: "30s", restSec: 30, note: "Knees down if needed" }] },
          { name: "Cool-down", durationMin: 5, items: [{ id: "childpose", sets: 1, reps: "1 min", restSec: 0, note: "" }] }
        ] },
      { date: "2026-10-10", dayNumber: 4, title: "Active recovery", focus: "Walk & mobility", type: "recovery",
        tip: "Recovery days are when you get stronger.",
        blocks: [
          { name: "Treadmill", durationMin: 20, items: [{ id: "treadmill", sets: 1, reps: "2 km", restSec: 0, note: "Easy pace" }] },
          { name: "Cool-down", durationMin: 10, items: [{ id: "catcow", sets: 2, reps: "10", restSec: 15, note: "" }, { id: "childpose", sets: 2, reps: "45s", restSec: 15, note: "" }] }
        ] },
      { date: "2026-10-11", dayNumber: 5, title: "Push & core", focus: "Chest, shoulders, core", type: "workout",
        tip: "Brace like someone's about to poke your belly.",
        blocks: [
          { name: "Main", durationMin: 30, items: [{ id: "gobletsquat", sets: 3, reps: "10", restSec: 60, note: "" }, { id: "plank", sets: 3, reps: "30s", restSec: 30, note: "" }] }
        ] }
    ]
  };
}
if (!window.Figures) {
  window.Figures = {
    ids: Object.keys(window.PLAN.exercises || {}),
    mount: function (el, id) {
      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 200 200");
      svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", 100); c.setAttribute("cy", 100); c.setAttribute("r", 40);
      c.setAttribute("fill", "#7CFFB2"); c.setAttribute("opacity", ".85");
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", 100); t.setAttribute("y", 185); t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", "#8AB4FF"); t.setAttribute("font-size", "12"); t.textContent = "stub: " + id;
      svg.appendChild(c); svg.appendChild(t); el.appendChild(svg);
      var start = performance.now(), raf = 0;
      (function loop(now) { var s = 1 + 0.25 * Math.sin((now - start) / 300); c.setAttribute("r", 40 * s); raf = requestAnimationFrame(loop); })(start);
      return { destroy: function () { cancelAnimationFrame(raf); svg.remove(); } };
    }
  };
}
