Continue developing the existing Bengali 3D game into a polished, high-quality open-world mission game.

Do not rebuild the working game from scratch. Begin with a read-only audit of the current repository, running game, build log, existing architecture, installed packages, assets and working features.

Preserve everything that already works. Fix or extend existing systems instead of duplicating them.

Use Context7 to verify current Babylon.js, Havok, Colyseus and Vite APIs before adding or changing dependencies.

# Main outcome

Turn the existing prototype into a polished semi-realistic 3D Dhaka mission game with:

- Full sound and music
- First-time tutorial
- Large mission map
- Four or five mission locations
- Traffic and pedestrians
- Driveable vehicles
- Collectible items
- Fictional leader and worker AI
- Non-graphic cartoon action
- Single-player
- Two-to-six-player private multiplayer
- Admin-controlled characters, missions, sounds and music
- Dynamic Bengali newspaper ending
- Desktop and mobile graphics profiles

The game must remain culturally Bangladeshi and visually inspired by Dhaka.

All politicians, parties, leaders, organizations and buildings must remain fictional. Do not copy real politicians, party logos, copyrighted game assets, GTA characters, GTA code, maps or music.

Use an original open-world mission structure with clear map markers and objectives. Do not copy another game’s protected content.

# Working method

Implement the expansion through the milestones below in order.

For every milestone:

1. Inspect the existing implementation.
2. Identify affected systems and regression risks.
3. Preserve working behavior.
4. Implement the smallest complete version.
5. Run focused tests.
6. Run broader regression checks.
7. Build and inspect the actual rendered game.
8. Update the build log with observed evidence.
9. Continue only when the milestone’s acceptance criteria pass.

Do not stop after writing a plan. Deliver working integrated code.

# Milestone A: Complete audio system

Create a production-quality audio architecture.

Audio categories:

- Master
- Music
- Environment
- Footsteps
- Vehicles
- Combat effects
- Character voices
- Crowd voices
- Interface sounds

Add separate volume controls and mute buttons for every category.

Persist settings on the device and restore them on the next visit.

## Footstep audio

Footsteps must react to the surface:

- Asphalt
- Concrete
- Brick footpath
- Dirt
- Mud
- Water
- Metal
- Shop floor

Walking and running must use different speed and intensity.

Footstep sounds must follow the animation timing. Do not play footsteps from a generic timer that becomes unsynchronized with the character’s feet.

## Movement and action sounds

Add sounds for:

- Walking
- Running
- Jumping
- Landing
- Picking up items
- Equipping items
- Throwing
- Hand attacks
- Sandal impact
- Egg impact
- Rubber-stone impact
- Inflatable-baton impact
- Fictional spark stun
- Character hit reaction
- Mission marker
- Mission complete
- Vehicle entry
- Vehicle exit
- Door
- Horn
- Engine start
- Engine idle
- Acceleration
- Braking
- Collision
- Ambulance siren
- Newspaper opening
- Menu buttons

Use spatial 3D audio for world sounds.

Nearby sounds must be louder. Distant sounds must fade naturally. Buildings and walls should reduce sound where practical.

## Dhaka ambience

Create layered ambient sound:

- Traffic
- Rickshaw bells
- CNG engines
- Bus horns
- Street conversations
- Tea-shop sounds
- Crow calls
- Distant construction
- Rain
- Night insects
- Distant microphones

Do not make every sound play continuously. Use randomized timing, distance and variation to avoid repetition.

## Background music

Add an Admin-managed music playlist.

Admin can:

- Upload licensed or original music
- Set track name
- Set volume
- Set loop
- Set order
- Set random play
- Assign tracks to menu, exploration, mission, chase and newspaper
- Set fade-in and fade-out
- Enable or disable tracks
- Preview tracks
- Publish changes

Use smooth crossfades when mission state changes.

Respect browser autoplay restrictions. Start music only after the player’s first click, keypress or touch interaction.

Do not include copyrighted commercial songs without permission.

# Milestone B: First-time tutorial and random spawn

At the start of a new game, place the main character at a safe random spawn point selected from Admin-approved locations.

Never spawn the character:

- Inside a building
- Inside traffic
- On another player
- Inside a mission crowd
- Inside water
- Outside the navigation area

Show a Bengali tutorial before normal gameplay begins.

Tutorial steps:

1. Move
2. Rotate camera
3. Run
4. Open mini-map
5. Pick up an item
6. Select an item
7. Throw or attack
8. Interact with a vehicle
9. Enter and exit a vehicle
10. View the first mission marker

Desktop controls:

- WASD or Arrow keys: movement
- Mouse: camera
- Shift: run
- Tab: vehicle interaction
- E: pickup and contextual interaction
- Left mouse or Enter: use selected item
- Number keys or mouse wheel: change item
- M: mini-map
- Esc: pause

Mobile controls:

- Left virtual joystick
- Swipe to rotate camera
- Run button
- Interaction button
- Item button
- Attack button
- Mini-map button

The tutorial must:

- Use Bengali text
- Show matching icons
- Pause dangerous AI while open
- Allow Skip
- Have “আর দেখাবেন না”
- Be replayable from Settings
- Adapt automatically to desktop or mobile controls

# Milestone C: Open-world Dhaka mission map

Expand the existing world into one connected but optimized fictional Dhaka map.

The mini-map must display four or five active mission areas.

Example areas:

- ক্ষমতা ভবন
- কমিটি গলি
- মাইক চত্বর
- প্রতিশ্রুতি মোড়
- পোস্টার পট্টি

Each area contains:

- One fictional leader
- Leader workers
- A crowd
- Road blockage
- Microphones or banners
- Nearby traffic
- Shops
- Pedestrians
- Mission entrance marker
- Safe vehicle parking or approach route

Use streaming or sector loading so the whole city is not fully active at once.

The mini-map must show:

- Main player
- Friends
- Active mission areas
- Completed mission areas
- Tea shops
- Vehicles
- Special pickups
- Ambulance
- Safe spawn points
- Route to selected objective

Allow the player to select a mission marker and show an original navigation route.

# Mission structure

Mission states:

- Undiscovered
- Discovered
- Selected
- Approaching
- Active
- Leader fleeing
- Evacuation
- Completed
- Failed
- Restartable

Example mission flow:

1. Player selects a location on the map.
2. Navigation route appears.
3. Player walks or uses a vehicle.
4. Mission title appears when entering the area.
5. Crowd and worker audio becomes audible.
6. Leader and worker AI activates.
7. Player collects or selects items.
8. Leader’s resolve meter decreases from successful cartoon hits.
9. Leader attempts to escape.
10. Player follows without leaving mission bounds.
11. When resolve reaches zero, the leader enters a non-graphic defeated state.
12. An ambulance arrives.
13. Paramedic NPCs place the fictional leader inside safely.
14. Ambulance leaves for the fictional hospital.
15. Mission marker becomes completed.
16. The next mission is highlighted.

Do not show blood, wounds, realistic suffering or death.

# Leader, worker and crowd AI

## Fictional leader

Leader behavior:

- Give a speech
- Gesture to workers
- React to the player
- Use cover
- Call workers
- Run away
- Change direction
- Enter an escape route
- Throw harmless cartoon props while fleeing
- React differently to different items
- Trigger voice lines
- Enter defeated animation
- Wait for ambulance evacuation

Leader must not stand still while being attacked.

Use a resolve or morale system instead of presenting realistic physical injury.

## Workers

Workers can:

- Stand around the leader
- Hold banners
- Use fictional slogans
- Follow the leader
- Block paths
- Warn the leader
- Move away from thrown items
- React to sounds
- Scatter after mission completion

Use fictional default slogans such as:

- “জয় ক্ষমতা!”
- “নেতা এগিয়ে চলো!”
- “কমিটি জিন্দাবাদ!”
- “মাইক চলবে!”

All slogans and crowd audio must be editable from Admin.

Do not ship real party propaganda or copyrighted political recordings as default content.

## Civilians

Civilians should:

- Walk using navigation paths
- Visit shops
- Wait at crossings
- Avoid traffic
- Move away from mission action
- Record events with phones
- React to sirens
- Enter tea shops
- Return to normal behavior after the mission

Unrelated civilians are not mission targets.

# Milestone D: Collectible items and action system

Street pickups:

- Egg
- Rubber sandal
- Cartoon rubber stone
- Inflatable baton
- Microphone sound device
- Fictional spark-stun device
- Tea or health item

Each pickup requires:

- 3D model
- Pickup animation
- Pickup sound
- Inventory icon
- Quantity
- Rarity
- Respawn rule
- Point value
- Range
- Cooldown
- Impact effect
- Leader reaction
- Admin configuration

Default score:

- Hand: 2
- Egg: 5
- Sandal: 8
- Rubber stone: 10
- Inflatable baton: 12
- Sound attack: 15
- Fictional spark stun: 20

Left mouse or Enter uses the selected item.

Use:

- Animation blending
- Hit detection
- Projectile physics
- Impact particles
- Short hit-stop
- Limited camera shake
- Spatial impact audio
- Leader voice reaction
- Crowd reaction

Player actions must remain exaggerated, non-graphic and fictional.

# Admin-controlled character voices

Create an Audio and Voice Manager in Admin.

Admin can upload authorized:

- MP3
- WAV
- OGG

Character voice triggers:

- Spawn
- Idle
- Player detected
- First hit
- Repeated hit
- Egg hit
- Sandal hit
- Rubber-stone hit
- Baton hit
- Spark stun
- Low resolve
- Escape started
- Chased
- Defeated
- Ambulance arrived
- Mission completed

Example fictional reactions:

- “ওরে বাবা!”
- “আমার লোক কই?”
- “ক্যামেরা বন্ধ কর!”
- “আগে কমিটি ডাকো!”
- “এইটা ষড়যন্ত্র!”
- “চা দাও, আলোচনা হবে!”
- “আমি তো এখানে ছিলাম না!”

Every voice entry needs:

- Character
- Trigger
- Audio file
- Bengali subtitle
- Volume
- Weight
- Cooldown
- Delay
- Maximum repetition
- Interrupt priority
- Enabled status
- Preview

Use weighted random selection and cooldown so the same sound does not repeat constantly.

# Milestone E: Traffic, shops and vehicles

Add believable city life.

Road system:

- Lane paths
- Traffic lights
- Intersections
- Stops
- Parking
- Traffic density profiles
- Collision avoidance
- Pedestrian crossings
- Mission roadblocks
- Ambulance priority route

Vehicles:

- Rickshaw
- CNG
- Autorickshaw
- Bicycle
- Motorcycle
- Private car
- Bus
- Ambulance

Every vehicle needs:

- Detailed optimized 3D model
- Wheels
- Steering
- Engine or movement sound
- Horn
- Seats
- Entry points
- Exit points
- Collision
- Vehicle health
- Speed
- Acceleration
- Braking
- Turning
- Camera position
- Mini-map marker where appropriate

## Vehicle interaction

When the player approaches a usable vehicle, show:

“Tab চাপুন — গাড়িতে উঠুন”

Pressing Tab:

1. Stops or slows the vehicle safely.
2. Driver reacts and exits without graphic violence.
3. Driver moves to a safe navigation position.
4. Player walks to the correct door or seat.
5. Enter animation plays.
6. Camera changes to vehicle mode.
7. Vehicle controls activate.

Pressing Tab again exits safely.

Friends can enter passenger seats.

Display available seats.

Passengers must remain attached to the correct seat and synchronize in multiplayer.

Do not teleport characters into vehicles unless animation cannot play because of a verified obstruction. Use a safe fallback only in that case.

# Milestone F: Single-player and multiplayer

The entire mission chain must work in single-player.

Also add private multiplayer for two to six players.

Room creation:

- Host creates private room.
- Server generates a short room code.
- Server generates a shareable join link.
- Friends open the link or enter the code.
- Friends choose a name and available character.
- Host starts the match.
- Every player controls their own character from their own computer.

Multiplayer requirements:

- One host role
- Up to five additional players
- Shared mission state
- Individual score
- Team score
- Shared mission markers
- Synced leader and worker AI
- Synced traffic near players
- Synced pickups
- Synced projectiles
- Synced vehicles
- Passenger seats
- Player reconnect
- Host migration or safe room closure
- Friendly fire disabled by default
- Server-authoritative score
- Server-authoritative mission completion
- Server-authoritative item quantities

Use client prediction for the local player and interpolation for remote players.

Do not trust client-reported score, hits, pickups, health, vehicle seats or mission completion.

The room must survive a temporary disconnect. Give the player at least 60 seconds to reconnect.

# Milestone G: Admin Panel

Admin must control the game without editing source code.

Admin modules:

- Game identity
- Bengali title and slogan
- Theme
- Loading screen
- Music
- Environment audio
- Impact sound effects
- Character voices
- Characters
- Workers
- Crowd slogans
- Items
- Point values
- Vehicles
- Spawn points
- Mission locations
- Mission sequence
- Mini-map markers
- Leader behavior
- Ambulance behavior
- Newspaper templates
- Multiplayer room limits
- Referral rewards
- Publish history
- Audit log

Use:

- Draft
- Preview
- Publish
- Rollback

Admin changes must affect the real game after publishing. Static forms or seed-only changes are not complete.

Audio and images must have file validation, size limits and preview.

Do not allow executable uploads, script-bearing SVG or unsafe paths.

# Milestone H: Bengali newspaper ending

After all mission locations are completed, create a full-screen Bengali newspaper.

The newspaper must include:

- Game-configured newspaper name
- Date
- Main Bengali headline
- Game-generated scene image
- Mission statistics
- Funny report
- Fictional quote
- Total score
- Team members
- Items used
- Vehicles driven
- Public outrage
- Camera evidence
- Completion time
- Player title
- Replay button
- Share button
- Home button

Capture an in-game image from the final mission or a safe replay camera. Do not generate a blank placeholder image.

Example fictional headlines:

- “পাঁচ মোড় মুক্ত, স্যান্ডেলের বাজারে হঠাৎ সংকট”
- “কমিটি গলি থেকে শেষ মাইক উদ্ধার”
- “কেটলি কেবিনেটে বসছে জরুরি আলোচনা”
- “রিকশায় চড়ে শহর বাঁচাল ছয় বন্ধু”
- “ডিম বিভাগের তদন্তে নতুন মোড়”

The report must combine configured templates with actual match statistics.

Admin can create and preview multiple headline and article templates.

# High-graphics polish

Improve the current visual quality without destroying performance.

Required:

- PBR road, concrete, metal, cloth and vehicle materials
- High-quality but optimized characters
- Rigged animations
- Animation blending
- Soft shadows
- Contact shadows
- Ambient occlusion when supported
- Image-based lighting
- Day and night lighting
- Rain and wet-road materials
- Reflection probes or efficient alternatives
- Subtle bloom
- Color grading
- Atmospheric depth
- Dust and paper particles
- Vehicle lights
- Shop lights
- Mission-area lighting
- Camera collision
- Smooth camera follow
- Limited motion blur only when appropriate

Do not hide weak assets with excessive darkness, bloom, fog or blur.

Use visual quality levels:

- Desktop High
- Desktop Medium
- Mobile Medium
- Mobile Low

Targets:

- 60 FPS on a reasonable desktop
- Stable 30 FPS on a normal Android phone

Use:

- LOD
- GPU instancing
- Texture compression
- Mesh compression
- Object pooling
- Frustum culling
- Sector streaming
- Reduced distant AI
- Shadow quality scaling
- Audio voice limits

# Bengali requirements

All visible player-facing content must be Bengali:

- Tutorial
- HUD
- Mission title
- Mission instructions
- Mini-map
- Vehicle prompts
- Item names
- Character names
- Dialogue subtitles
- Settings
- Multiplayer lobby
- Error messages
- Newspaper

English may be available as an optional secondary language, but Bengali is the default.

Verify Bengali যুক্তাক্ষর, কার, ফলা and punctuation on desktop and mobile.

# Verification

Do not claim completion based only on compilation.

Required verification:

1. Typecheck.
2. Lint.
3. Unit tests.
4. API integration tests.
5. Production build.
6. Production runtime.
7. Desktop gameplay.
8. Mobile viewport gameplay.
9. Audio after browser user interaction.
10. Footstep synchronization.
11. Mission state transitions.
12. Leader escape and ambulance flow.
13. Every vehicle entry and exit.
14. Passenger seating.
15. Two-player multiplayer.
16. Six-player multiplayer.
17. Reconnection.
18. Host leaving.
19. Admin save, preview, publish and rollback.
20. Admin audio changes appearing in real gameplay.
21. Bengali newspaper generated from actual match statistics.
22. Desktop and mobile FPS measurement.
23. Screenshots from day, night, mission and multiplayer scenes.
24. Regression check of all previously working features.

Record actual evidence in the build log.

# Completion report

Report:

- Existing architecture found
- Systems preserved
- Files changed
- Milestones completed
- Tests run and results
- Runtime flows verified
- Desktop and mobile FPS
- Multiplayer player count tested
- Admin-to-game configuration verified
- Audio files and licenses
- 3D asset sources and licenses
- Screenshots created
- Known limitations
- Remaining incomplete work

Do not mark a milestone complete without observed evidence.

Continue through the milestones in order. If a genuine blocker prevents progress, complete every safe independent milestone first, then report the exact blocker and evidence.