var flotilla = require("./flotilla");

/*
 * Flotilla Node-RED Node
 * 
 * - Should support multiple docks
 * - Each dock has up to 8 connected modules
 * - Each module may have one or more inputs or outputs;
 *    - Like temperature/pressure as inputs on Weather
 *    - Or time/temperature as outputs on Number
 *
 * UX
 * 
 * A drop down list should display a list of Docks. Ideally any connected dock would be queried for its particulars
 * so that this list could use the dock friendly-name if its set.
 *
 * Once a Dock is selected, an asyncronous connection is established and maintained, and the connected modules enumerated.
 *
 * The list of connected modules populates a second drop down list (or a nice grid of icons if we're feeling sassy)
 *
 * Selecting/clicking a connected module would prompt a third UI widget for selecting a particular module output/input stream and configuring options.
 *
 * Internally
 *
 * The Flotilla onUpdate hook would be used to collect updates from connected modules and dispatch them to the nodes concerned.
 *
 * The relationship between nodes and Docks should be keyed upon comPort
 *
*/
