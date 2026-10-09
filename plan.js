// Gym plan: 9 Oct 2026 (Day 3) -> 21 Oct 2026 (Day 15). Lower-back safe. Plain browser JS.
(function () {
  // ---------- helpers ----------
  function it(id, sets, reps, restSec, note) {
    return { id: id, sets: sets, reps: reps, restSec: restSec, note: note };
  }
  function blk(name, durationMin, items) {
    return { name: name, durationMin: durationMin, items: items };
  }

  var TM = {
    walk: "Brisk walk 5.5–6 km/h, 1% incline. Stand tall, don't hold the rails.",
    walkJog: "Walk 3 min at 6 km/h, then alternate 1 min easy jog (7.5–8 km/h) / 1 min walk. Stop jogging if your back feels anything.",
    jog: "Light jog 7.5–8.5 km/h if comfortable; walk any part that feels jarring. You should be able to talk.",
    easy: "Easy brisk walk 5.5–6 km/h, 1% incline. Today is about loosening up, not pace."
  };

  function treadmill(note) {
    return blk("Treadmill", 9, [it("treadmill_1km", 1, "1 km", 60, note)]);
  }

  function warmup() {
    return blk("Warm-up", 5, [
      it("cat_cow", 1, "8 slow", 0, "Move gently through a pain-free range, breathe out as you round"),
      it("bird_dog", 1, "6/side", 0, "Hold 2s at the top, hips stay level"),
      it("glute_bridge", 1, "10", 30, "Squeeze glutes to lift; ribs stay down, no arching")
    ]);
  }

  function upperWarmup() {
    return blk("Warm-up", 5, [
      it("cat_cow", 1, "8 slow", 0, "Gentle range only"),
      it("bird_dog", 1, "6/side", 0, "Hold 2s at the top"),
      it("face_pull", 1, "15", 30, "Very light — just waking up the upper back")
    ]);
  }

  function finisher(kind, min, note) {
    return blk("Finisher", min, [it(kind, 1, min + " min", 0, note)]);
  }

  function cooldown() {
    return blk("Cool-down", 4, [
      it("knee_to_chest_stretch", 1, "30s/side", 0, "Lying on your back, relax into it — no bouncing"),
      it("hip_flexor_stretch", 1, "30s/side", 0, "Squeeze the glute of the back leg; don't arch the lower back"),
      it("child_pose", 1, "45s", 0, "Breathe slowly into your lower back")
    ]);
  }

  function recoveryDay(date, dayNumber, title, tip, tmNote, walkNote) {
    return {
      date: date, dayNumber: dayNumber, title: title,
      focus: "Mobility, back-protecting core, easy walking — let muscles recover",
      type: "recovery", tip: tip,
      blocks: [
        treadmill(tmNote),
        blk("Mobility", 8, [
          it("cat_cow", 2, "8 slow", 20, "Slow and controlled, pain-free range"),
          it("glute_bridge", 2, "12", 30, "2s squeeze at the top"),
          it("hip_flexor_stretch", 1, "40s/side", 0, "Tight hip flexors pull on the lower back after sitting — this helps")
        ]),
        blk("Core (McGill Big 3 + extras)", 14, [
          it("mcgill_curl_up", 3, "6 × 8s holds", 30, "Head and shoulders lift only slightly; lower back stays neutral with hands under it"),
          it("side_plank_knee", 3, "20s/side", 30, "Straight line knee to head; don't let hips sag"),
          it("bird_dog", 3, "6/side × 5s", 30, "Imagine a glass of water on your lower back — don't spill it"),
          it("dead_bug", 2, "8/side", 45, "Lower back pressed to floor the whole time; shorten the reach if it lifts")
        ]),
        blk("Incline Walk", 12, [it("incline_walk", 1, "12 min", 0, walkNote)]),
        blk("Cool-down", 5, [
          it("knee_to_chest_stretch", 1, "40s/side", 0, "Relax into it"),
          it("child_pose", 1, "60s", 0, "Slow breathing"),
          it("hip_flexor_stretch", 1, "30s/side", 0, "Glute squeezed, ribs down")
        ])
      ]
    };
  }

  // ---------- exercise library ----------
  var exercises = {
    treadmill_1km: {
      name: "Treadmill 1 km", equipment: "Treadmill", target: "Heart, legs — warm-up",
      cues: ["Start slow for the first 200 m", "Stand tall, eyes forward, arms swinging naturally", "Short, quiet steps — land under your hips", "Don't grip the handrails"],
      backSafety: "Keep strides short; long over-reaching steps jolt the lower back. Walk instead of jog if anything twinges."
    },
    incline_walk: {
      name: "Incline Walk", equipment: "Treadmill", target: "Fat burn, glutes, low-impact cardio",
      cues: ["Set 5–8% incline, 4.5–5.5 km/h", "Stand upright — lean only slightly from the ankles", "Hands off the rails", "Breathing should be heavier but you can still talk"],
      backSafety: "If you need the rails or start leaning forward from the waist, lower the incline."
    },
    stationary_bike: {
      name: "Stationary Bike", equipment: "Upright or recumbent bike (recumbent is best for the back)", target: "Low-impact cardio, legs",
      cues: ["Seat height: slight bend in knee at the bottom of the pedal", "Sit tall, chest open, light grip", "Steady cadence ~80 rpm, moderate resistance", "Finish the last minute easy"],
      backSafety: "Prefer the recumbent (back-supported) bike. Don't hunch over the handlebars."
    },
    cat_cow: {
      name: "Cat-Cow", equipment: "Mat", target: "Spine mobility",
      cues: ["On hands and knees, hands under shoulders, knees under hips", "Breathe out: gently round the back up", "Breathe in: gently let the belly drop and look forward", "Slow, small, smooth"],
      backSafety: "Stay in a comfortable range — this is a gentle loosener, not a stretch to push."
    },
    bird_dog: {
      name: "Bird Dog", equipment: "Mat", target: "Core stability, glutes, back endurance",
      cues: ["On hands and knees, back flat like a table", "Reach one arm forward and the opposite leg back", "Hold 2–5 s, hips stay level — don't rotate", "Return slowly and switch sides"],
      backSafety: "Only lift the leg to hip height — lifting higher arches the lower back."
    },
    dead_bug: {
      name: "Dead Bug", equipment: "Mat", target: "Deep core (anti-extension)",
      cues: ["Lie on back, arms up, knees bent 90° over hips", "Press lower back gently into the floor", "Slowly lower opposite arm and leg, breathe out", "Return and switch sides"],
      backSafety: "If your lower back lifts off the floor, don't reach as far. Keep it pressed down."
    },
    glute_bridge: {
      name: "Glute Bridge", equipment: "Mat", target: "Glutes, hamstrings",
      cues: ["Lie on back, feet flat hip-width, close to your bum", "Squeeze glutes and push through heels to lift hips", "Stop when body is a straight line knees-to-shoulders", "Pause 2 s, lower slowly"],
      backSafety: "Lift with the glutes, not the back — don't arch past the straight line."
    },
    mcgill_curl_up: {
      name: "McGill Curl-Up", equipment: "Mat", target: "Abs without spinal flexion",
      cues: ["Lie on back, one knee bent, one leg straight", "Hands under the small of your back to keep its natural curve", "Lift head and shoulders just 2–3 cm, chin tucked", "Hold 8–10 s, breathe, lower"],
      backSafety: "This is NOT a crunch — the lower back never flattens or rounds. Tiny lift only."
    },
    side_plank_knee: {
      name: "Side Plank (Knees)", equipment: "Mat", target: "Obliques, side core (anti-lateral bend)",
      cues: ["Lie on side, elbow under shoulder, knees bent", "Lift hips so body is straight from knees to head", "Top hand on hip, keep chest facing forward", "Breathe normally while holding"],
      backSafety: "Don't let hips sag or rotate back. Stop before form breaks."
    },
    front_plank_knee: {
      name: "Front Plank (Knees)", equipment: "Mat", target: "Core (anti-extension)",
      cues: ["Elbows under shoulders, knees on mat", "Straight line knees to head", "Squeeze glutes, gently brace abs", "Breathe — don't hold your breath"],
      backSafety: "If the lower back sags or aches, end the set. Quality over time."
    },
    pallof_press: {
      name: "Pallof Press", equipment: "Cable machine, handle at chest height", target: "Core (anti-rotation)",
      cues: ["Stand side-on to the cable, feet shoulder-width, soft knees", "Hold handle at chest, press straight out", "Resist the pull — don't let your body twist", "Hold 2 s, bring back to chest"],
      backSafety: "Use light weight. If you twist or lean, step closer to the machine."
    },
    leg_press: {
      name: "Leg Press", equipment: "Leg press machine", target: "Quads, glutes",
      cues: ["Back and hips flat against the pad the whole time", "Feet shoulder-width, mid-platform", "Lower until knees are ~90°, then push through whole foot", "Don't lock the knees at the top"],
      backSafety: "Don't let hips curl off the seat at the bottom — stop the range there."
    },
    box_squat_db: {
      name: "Box Squat (Dumbbell Goblet)", equipment: "Bench/box + one light dumbbell", target: "Quads, glutes",
      cues: ["Hold dumbbell at chest, feet shoulder-width in front of a bench", "Sit back and down until you lightly touch the bench", "Chest up, knees track over toes", "Stand by pushing through heels"],
      backSafety: "Touch the bench, don't flop onto it. Keep chest up — no rounding at the bottom. Light dumbbell only."
    },
    leg_curl_seated: {
      name: "Seated Leg Curl", equipment: "Seated leg curl machine", target: "Hamstrings",
      cues: ["Knees line up with the machine's pivot", "Thigh pad snug, back against the pad", "Curl heels down and back, 1 s squeeze", "Return slowly over 2–3 s"],
      backSafety: "Seated version keeps the back supported. Keep your back on the pad — don't lean forward."
    },
    leg_extension: {
      name: "Leg Extension", equipment: "Leg extension machine", target: "Quads",
      cues: ["Knees line up with the machine's pivot", "Pad sits just above the ankles", "Straighten legs smoothly, squeeze 1 s", "Lower slowly"],
      backSafety: "Hold the handles and keep your back against the pad; no swinging."
    },
    hip_abduction: {
      name: "Hip Abduction Machine", equipment: "Hip abduction machine", target: "Side glutes (glute medius)",
      cues: ["Sit tall, back against the pad", "Push knees outward against the pads", "Pause 1 s at the widest point", "Return slowly — don't let the weights slam"],
      backSafety: "Strong side glutes stabilise the pelvis and help protect the lower back. Stay seated upright."
    },
    calf_raise_machine: {
      name: "Calf Raise (Machine)", equipment: "Seated calf raise or leg press platform", target: "Calves",
      cues: ["Balls of feet on the edge, heels free", "Rise up as high as you can, pause 1 s", "Lower heels slowly below the platform", "Full range, no bouncing"],
      backSafety: "Use the seated or leg-press version — not a standing machine with weight on the shoulders."
    },
    lat_pulldown: {
      name: "Lat Pulldown", equipment: "Lat pulldown machine", target: "Lats, upper back (V-shape)",
      cues: ["Thighs locked under the pad, grip a bit wider than shoulders", "Lean back only slightly, chest up", "Pull bar to upper chest by driving elbows down", "Control it back up to full stretch"],
      backSafety: "Don't rock or swing your torso to move the weight — if you must, it's too heavy."
    },
    seated_cable_row: {
      name: "Seated Cable Row", equipment: "Cable row station (chest pad if available)", target: "Mid back, lats, posture",
      cues: ["Sit tall, slight knee bend, chest up", "Pull handle to your lower ribs, elbows close", "Squeeze shoulder blades together 1 s", "Let arms straighten forward without rounding your back"],
      backSafety: "Torso stays still and upright. Don't lean forward to reach or lean back to yank."
    },
    chest_press_machine: {
      name: "Chest Press (Machine)", equipment: "Seated chest press machine", target: "Chest, front shoulders, triceps",
      cues: ["Seat height: handles at mid-chest", "Back flat against the pad, shoulder blades pulled back", "Press out smoothly, don't lock elbows", "Return slowly until a mild chest stretch"],
      backSafety: "Feet flat on the floor, back stays on the pad — don't arch to push more weight."
    },
    shoulder_press_machine: {
      name: "Shoulder Press (Machine)", equipment: "Seated shoulder press machine with back pad", target: "Shoulders, triceps",
      cues: ["Seat so handles start at shoulder height", "Back and head against the pad", "Press up without fully locking elbows", "Lower slowly to shoulder height"],
      backSafety: "Seated with back support only. Brace abs so the lower back doesn't arch off the pad."
    },
    face_pull: {
      name: "Face Pull", equipment: "Cable machine with rope, set at face height", target: "Rear shoulders, upper back, posture",
      cues: ["Step back, arms straight, rope at face height", "Pull rope toward your forehead, hands apart", "Elbows high, squeeze shoulder blades", "Return slowly"],
      backSafety: "Stand tall with soft knees, staggered stance for balance. Light weight — no leaning back."
    },
    db_curl_seated: {
      name: "Seated Dumbbell Curl", equipment: "Incline/upright bench + dumbbells", target: "Biceps",
      cues: ["Sit with back against the bench pad", "Elbows pinned by your sides", "Curl up, turn palms to face you, squeeze", "Lower slowly over 2–3 s"],
      backSafety: "Back supported on the pad. No swinging — the torso doesn't move."
    },
    tricep_pushdown: {
      name: "Tricep Pushdown", equipment: "Cable machine with rope or bar, set high", target: "Triceps",
      cues: ["Stand tall, elbows tucked at your sides", "Push down until arms are straight, squeeze", "Only the forearms move", "Control the way up"],
      backSafety: "Stand upright with soft knees; don't lean over the cable to push heavier."
    },
    knee_to_chest_stretch: {
      name: "Knee-to-Chest Stretch", equipment: "Mat", target: "Lower back, glutes",
      cues: ["Lie on your back", "Hug one knee gently toward your chest", "Other leg relaxed (bent or straight)", "Breathe and relax; switch sides"],
      backSafety: "Gentle pull only. Keep your head down on the mat."
    },
    hip_flexor_stretch: {
      name: "Half-Kneeling Hip Flexor Stretch", equipment: "Mat (pad under knee)", target: "Hip flexors",
      cues: ["Kneel on one knee, other foot forward", "Tuck tailbone under and squeeze the back-leg glute", "Shift forward slightly until you feel the front of the hip", "Stay tall, breathe"],
      backSafety: "Don't arch your lower back to go deeper — the glute squeeze does the work."
    },
    child_pose: {
      name: "Child's Pose", equipment: "Mat", target: "Lower back, lats — relaxation",
      cues: ["Kneel, big toes together, knees apart", "Sit hips back toward your heels", "Reach arms forward, forehead down", "Breathe slowly into your back"],
      backSafety: "If knees or back complain, put a pillow under your hips and don't sit back as far."
    }
  };

  // ---------- days ----------
  var days = [
    // Day 3 — Fri 9 Oct
    {
      date: "2026-10-09", dayNumber: 3, title: "Upper Body — Foundation",
      focus: "Learn the machines, light weight (RPE 5–6)", type: "workout",
      tip: "Get protein at every meal (eggs, paneer, dal, chicken, curd). It keeps you full and helps muscles recover.",
      blocks: [
        treadmill(TM.walk),
        blk("Warm-up", 2, [
          it("cat_cow", 1, "6 slow", 0, "Quick but gentle: wakes up the lower back before pulling"),
          it("glute_bridge", 1, "10", 0, "Squeeze glutes to lift; ribs stay down, no arching")
        ]),
        blk("Main", 38, [
          it("lat_pulldown", 3, "12", 75, "Light — learn to pull with the elbows, not the hands"),
          it("chest_press_machine", 3, "12", 75, "Adjust seat so handles are at mid-chest"),
          it("seated_cable_row", 3, "12", 75, "Sit tall; squeeze shoulder blades"),
          it("shoulder_press_machine", 2, "12", 60, "Back flat on the pad; stop just short of locking elbows"),
          it("db_curl_seated", 2, "12", 45, "Back against the bench; no swinging"),
          it("tricep_pushdown", 2, "12", 45, "Elbows pinned to your sides; stand tall, slight knee bend"),
          it("dead_bug", 2, "8/side", 45, "Lower back stays on the floor")
        ]),
        finisher("stationary_bike", 7, "Easy-moderate pace; recumbent bike if available"),
        cooldown()
      ]
    },
    // Day 4 — Sat 10 Oct
    {
      date: "2026-10-10", dayNumber: 4, title: "Upper Body — Posture",
      focus: "Back and shoulders for better posture, light (RPE 5–6)", type: "workout",
      tip: "Drink about 3 L of water today. Carry a bottle — most 'hunger' between meals is thirst.",
      blocks: [
        treadmill(TM.walk),
        upperWarmup(),
        blk("Main", 35, [
          it("lat_pulldown", 3, "12", 75, "Bar to upper chest, chest up"),
          it("seated_cable_row", 3, "12", 75, "Pause 1 s with shoulder blades squeezed"),
          it("chest_press_machine", 3, "12", 75, "Back flat on the pad"),
          it("shoulder_press_machine", 2, "12", 75, "Light; back and head on the pad"),
          it("face_pull", 2, "15", 45, "Elbows high, slow"),
          it("pallof_press", 2, "10/side", 45, "Don't let the cable twist you")
        ]),
        finisher("incline_walk", 7, "5% incline, 5 km/h, hands off rails"),
        cooldown()
      ]
    },
    // Day 5 — Sun 11 Oct
    {
      date: "2026-10-11", dayNumber: 5, title: "Lower Body — Machines",
      focus: "Glutes and legs with back-supported machines (RPE 5–6)", type: "workout",
      tip: "Cut sugary drinks and juices completely — it's the easiest fat-loss win with zero effort in the gym.",
      blocks: [
        treadmill(TM.walk),
        warmup(),
        blk("Main", 35, [
          it("leg_press", 3, "12", 90, "Hips stay on the seat at the bottom"),
          it("leg_curl_seated", 3, "12", 60, "Squeeze 1 s at the bottom"),
          it("leg_extension", 2, "12", 60, "Smooth, no kicking"),
          it("hip_abduction", 3, "15", 45, "Pause at the widest point"),
          it("glute_bridge", 2, "12", 45, "2 s squeeze at top"),
          it("calf_raise_machine", 2, "15", 45, "Full range, slow"),
          it("side_plank_knee", 2, "20s/side", 30, "Hips up, straight line")
        ]),
        finisher("stationary_bike", 7, "Easy spin to flush the legs"),
        cooldown()
      ]
    },
    // Day 6 — Mon 12 Oct (recovery after 3 straight days)
    recoveryDay("2026-10-12", 6, "Active Recovery — Mobility & Core",
      "Aim for 7–8 hours of sleep. Muscle repair and appetite control both get worse when you're short on sleep.",
      TM.easy,
      "5–6% incline, 4.5–5 km/h. Conversational pace."),
    // Day 7 — Tue 13 Oct
    {
      date: "2026-10-13", dayNumber: 7, title: "Upper Body — V-Shape Build",
      focus: "Wider back, fuller chest — small weight increases (RPE 6–7)", type: "workout",
      tip: "Walk 8,000 steps today outside the gym — take calls on foot. It burns more than the finisher does.",
      blocks: [
        treadmill(TM.walkJog),
        upperWarmup(),
        blk("Main", 35, [
          it("lat_pulldown", 3, "10", 90, "Add one plate (2.5–5 kg) vs last time if all 12 reps were clean"),
          it("chest_press_machine", 3, "10", 90, "Small weight increase; control the return"),
          it("seated_cable_row", 3, "10", 75, "Slightly heavier; torso stays still"),
          it("shoulder_press_machine", 3, "10", 75, "Back on the pad, no arching"),
          it("face_pull", 2, "15", 45, "Posture work — keep it light"),
          it("tricep_pushdown", 2, "12", 45, "Elbows pinned at sides")
        ]),
        finisher("incline_walk", 7, "6% incline, 5 km/h"),
        cooldown()
      ]
    },
    // Day 8 — Wed 14 Oct
    {
      date: "2026-10-14", dayNumber: 8, title: "Lower Body — Build",
      focus: "Slightly heavier legs and glutes (RPE 6–7)", type: "workout",
      tip: "Fill half your plate with vegetables at lunch and dinner. Same fullness, far fewer calories.",
      blocks: [
        treadmill(TM.walkJog),
        warmup(),
        blk("Main", 35, [
          it("leg_press", 3, "10", 90, "Add 5–10 kg if last session felt easy; hips stay down"),
          it("box_squat_db", 2, "10", 75, "Light dumbbell; touch the bench softly, chest up"),
          it("leg_curl_seated", 3, "10", 60, "Slightly heavier"),
          it("hip_abduction", 3, "15", 45, "Pause 1 s"),
          it("calf_raise_machine", 2, "15", 45, "Slow and full range"),
          it("dead_bug", 2, "8/side", 45, "Back flat on the floor")
        ]),
        finisher("stationary_bike", 7, "Moderate resistance, steady pace"),
        cooldown()
      ]
    },
    // Day 9 — Thu 15 Oct
    {
      date: "2026-10-15", dayNumber: 9, title: "Full Body — Build",
      focus: "Everything once, a bit heavier than Day 3 (RPE 6–7)", type: "workout",
      tip: "Keep eating normally — don't crash diet. A small daily deficit is enough; starving makes you look flat and tired.",
      blocks: [
        treadmill(TM.walkJog),
        warmup(),
        blk("Main", 35, [
          it("leg_press", 3, "10", 90, "Same or slightly more than Day 8"),
          it("lat_pulldown", 3, "10", 75, "Elbows drive down to your sides"),
          it("chest_press_machine", 3, "10", 75, "Controlled tempo"),
          it("seated_cable_row", 2, "12", 60, "Squeeze 1 s"),
          it("db_curl_seated", 2, "12", 45, "Back on the bench pad"),
          it("pallof_press", 2, "10/side", 45, "Resist rotation")
        ]),
        finisher("incline_walk", 7, "6–7% incline, 5 km/h"),
        cooldown()
      ]
    },
    // Day 10 — Fri 16 Oct (recovery after 3 straight days)
    recoveryDay("2026-10-16", 10, "Active Recovery — Back Care",
      "Check your posture at your desk: screen at eye level, feet flat, get up every 45 minutes. Sitting slumped is hard on a recovering back.",
      TM.easy,
      "6–7% incline, 4.5–5 km/h. Steady and easy."),
    // Day 11 — Sat 17 Oct
    {
      date: "2026-10-17", dayNumber: 11, title: "Upper Body — Peak Build",
      focus: "Heaviest upper session — still clean form (RPE 7)", type: "workout",
      tip: "Go easy on alcohol this weekend — it adds empty calories and water retention, and wrecks sleep.",
      blocks: [
        treadmill(TM.jog),
        upperWarmup(),
        blk("Main", 35, [
          it("lat_pulldown", 4, "10", 90, "Small increase if Day 7 felt solid"),
          it("chest_press_machine", 3, "10", 90, "Small increase; never arch off the pad"),
          it("seated_cable_row", 3, "10", 75, "Chest up, squeeze"),
          it("shoulder_press_machine", 3, "10", 75, "Same weight as Day 7 is fine"),
          it("face_pull", 2, "15", 45, "Elbows high"),
          it("db_curl_seated", 2, "12", 45, "Slow lowering"),
          it("tricep_pushdown", 2, "12", 45, "Squeeze at bottom")
        ]),
        finisher("incline_walk", 7, "7% incline, 5 km/h"),
        cooldown()
      ]
    },
    // Day 12 — Sun 18 Oct
    {
      date: "2026-10-18", dayNumber: 12, title: "Lower Body — Maintain",
      focus: "Hold the weights you reached, no new increases (RPE 6–7)", type: "workout",
      tip: "Plan your travel outfit and get a haircut booked this week — honestly, it changes how you look more than 4 extra days of gym will.",
      blocks: [
        treadmill(TM.jog),
        warmup(),
        blk("Main", 35, [
          it("leg_press", 3, "10", 90, "Same weight as Day 8 — no increase"),
          it("leg_curl_seated", 3, "10", 60, "Same weight"),
          it("leg_extension", 2, "12", 60, "Controlled"),
          it("hip_abduction", 3, "15", 45, "Pause at the top"),
          it("glute_bridge", 2, "12", 45, "2 s squeeze"),
          it("side_plank_knee", 2, "25s/side", 30, "Hips high")
        ]),
        finisher("stationary_bike", 7, "Steady, moderate"),
        cooldown()
      ]
    },
    // Day 13 — Mon 19 Oct
    {
      date: "2026-10-19", dayNumber: 13, title: "Full Body — Maintain",
      focus: "Same weights as last week, crisp form (RPE 6–7)", type: "workout",
      tip: "Start cutting back on salt today (pickles, namkeen, packaged snacks, restaurant food). Less salt for 3 days = less puffiness in the face and belly.",
      blocks: [
        treadmill(TM.jog),
        warmup(),
        blk("Main", 35, [
          it("leg_press", 3, "10", 90, "Same weight as Day 12"),
          it("lat_pulldown", 3, "10", 75, "Same weight as Day 11"),
          it("chest_press_machine", 3, "10", 75, "Same weight as Day 11"),
          it("seated_cable_row", 3, "12", 60, "Focus on the squeeze"),
          it("front_plank_knee", 2, "30s", 45, "Straight line, breathe")
        ]),
        finisher("incline_walk", 7, "6–7% incline, 5 km/h"),
        cooldown()
      ]
    },
    // Day 14 — Tue 20 Oct
    {
      date: "2026-10-20", dayNumber: 14, title: "Upper Body — Maintain",
      focus: "Moderate weights, posture focus — no soreness tomorrow (RPE 6)", type: "workout",
      tip: "Keep salt low and water high (~3 L). Skip heavy, oily dinners — you'll wake up less bloated.",
      blocks: [
        treadmill(TM.jog),
        upperWarmup(),
        blk("Main", 35, [
          it("lat_pulldown", 3, "12", 75, "Slightly lighter than Day 11, more reps"),
          it("chest_press_machine", 3, "12", 75, "Slightly lighter, smooth"),
          it("seated_cable_row", 3, "12", 60, "Squeeze shoulder blades"),
          it("shoulder_press_machine", 2, "12", 60, "Light"),
          it("face_pull", 3, "15", 45, "Posture — shoulders back and down"),
          it("pallof_press", 2, "10/side", 45, "Steady")
        ]),
        finisher("stationary_bike", 7, "Easy-moderate"),
        cooldown()
      ]
    },
    // Day 15 — Wed 21 Oct (day before travel)
    {
      date: "2026-10-21", dayNumber: 15, title: "Pump & Posture — Light",
      focus: "Light pump, open the chest, stand tall — stay fresh for travel (RPE 5)", type: "workout",
      tip: "Pack tonight, eat a normal low-salt dinner, sleep early. Stand tall tomorrow — good posture is the quickest 'look better' there is.",
      blocks: [
        treadmill(TM.easy),
        upperWarmup(),
        blk("Main", 35, [
          it("lat_pulldown", 2, "15", 60, "Light — about 60% of your Day 11 weight"),
          it("chest_press_machine", 2, "15", 60, "Light, feel the squeeze"),
          it("seated_cable_row", 2, "15", 60, "Light, chest proud"),
          it("face_pull", 3, "15", 45, "Shoulders back — posture"),
          it("db_curl_seated", 2, "15", 45, "Light pump"),
          it("tricep_pushdown", 2, "15", 45, "Light pump"),
          it("bird_dog", 2, "6/side", 30, "Slow and steady"),
          it("side_plank_knee", 2, "20s/side", 30, "Easy hold")
        ]),
        finisher("incline_walk", 7, "Easy 4–5% incline, nothing hard today"),
        cooldown()
      ]
    }
  ];

  window.PLAN = {
    startDate: "2026-10-09",
    tripDate: "2026-10-22",
    dayNumberOffset: 2,
    exercises: exercises,
    days: days
  };
})();
