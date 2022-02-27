import { toggleDefeatedStatus, toggleHidden } from "./actor-actions.mjs";

export class CypherCombatSidebar {
  // This must be called in the `init` hook in order for the other hooks to ire correctly.
  startup() {

    Hooks.on('ready', () => {

      // Stat changes/updates in the combat tracker.
      $('body').on('change', '.combat-input', (event) => {
        event.preventDefault();

        // Get the incput and actor element.
        const dataset = event.currentTarget.dataset;
        let $input = $(event.currentTarget);
        let $actorRow = $input.parents('.directory-item.actor-elem');

        // If there isn't an actor element, don't proceed.
        if (!$actorRow.length > 0) {
          return;
        }

        // Retrieve the combatant for this actor, or exit if not valid.
        const combatant = game.combat.data.combatants.find(c => c.data._id == $actorRow.data('combatant-id'));
        if (!combatant) {
          return;
        }

        const actor = combatant.actor;

        // Check for bad numbers, otherwise convert into a Number type.
        let value = $input.val();
        if (dataset.dtype == 'Number') {
          value = Number(value);
          if (Number.isNaN(value)) {
            if ($input[0].id == "might") {
              $input.val(actor.data.data.pools.might.value);
            }
            if ($input[0].id == "speed") {
              $input.val(actor.data.data.pools.speed.value);
            }
            if ($input[0].id == "intellect") {
              $input.val(actor.data.data.pools.intellect.value);
            }
            if ($input[0].id == "health") {
              $input.val(actor.data.data.health.value);
            }
            return false;
          }
        }

        // Prepare update data for the actor.
        let updateData = {};
        // If this started with a "+" or "-", handle it as a relative change.
        let operation = $input.val().match(/^\+|\-/g);
        if (operation) {
          if ($input[0].id == "might") {
            updateData[$input.attr('name')] = Number(actor.data.data.pools.might.value) + value;
          }
          if ($input[0].id == "speed") {
            updateData[$input.attr('name')] = Number(actor.data.data.pools.speed.value) + value;
          }
          if ($input[0].id == "intellect") {
            updateData[$input.attr('name')] = Number(actor.data.data.pools.intellect.value) + value;
          }
          if ($input[0].id == "health") {
            updateData[$input.attr('name')] = Number(actor.data.data.health.value) + value;
          }
        }
        // Otherwise, set it absolutely.
        else {
          updateData[$input.attr('name')] = value;
        }

        // Update stats and invoke toggleTokenSkull
        actor.update(updateData);

        return;
      });

    });

    // Mouse events to highlight and pan to token
    Hooks.on('ready', () => {

      let token;

      const findToken = (event) => {
        const combatant = event.currentTarget;
        const c = combatant.dataset.actorId;
        token = canvas.tokens.placeables.find(t => t.data.actorId == c);
        return token;
      };

      $('body').on('mouseenter', '.combatant', (event) => {
        findToken(event);
        if (token.isOwner || game.user.isGM) {
          if (token?.isVisible) {
            if (!token._controlled) token._onHoverIn();
          }
        }
      });

      $('body').on('mouseleave', '.combatant', (event) => {
        findToken(event);
        token._onHoverOut();
      });

      $('body').on('click', '.combat-control', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.currentTarget;

        const currentTurn = () => {
          setTimeout(() => {
            let currentCombatant = game.combat.current.combatantId
            let trackers = $('.combatant')
            let li = trackers.closest(`[data-combatant-id=${currentCombatant}]`);
            li[0].classList.add('active');
          }, 50);
        };

        if (game.combat.turns.length > 0) {
          switch (btn.dataset.control) {
            case "startCombat":
            case "previousTurn":
            case "nextTurn":
              currentTurn()
              break;
          }
        }
      });

      $('body').on('click', '.combatant-control', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const btn = event.currentTarget;
        const li = btn.closest(".combatant");
        const combatant = game.combat.combatants.get(li.dataset.combatantId);

        switch (btn.dataset.control) {
          // Toggle combatant visibility
          case "toggleHidden":
            toggleHidden(combatant)
            break;
          case "markImpaired":
            if (combatant.actor.data.data.damage.damageTrack == "Impaired") {
              combatant.actor.update({ "data.damage.damageTrack": 'Hale' })
            } else {
              combatant.actor.update({ "data.damage.damageTrack": 'Impaired' })
            }
            if (combatant.isDefeated) {
              toggleDefeatedStatus(combatant);
            }
            break;
          case "markDebilitated":
            if (combatant.actor.data.data.damage.damageTrack == "Debilitated") {
              combatant.actor.update({ "data.damage.damageTrack": 'Hale' })
            } else {
              combatant.actor.update({ "data.damage.damageTrack": 'Debilitated' })
            }
            break;
          case "markDead":
            if (combatant.actor.type == 'PC') {
              if (combatant.actor.data.data.damage.damageTrack == "Dead") {
                combatant.actor.update({ "data.damage.damageTrack": 'Hale' })
              } else {
                combatant.actor.update({ "data.damage.damageTrack": 'Dead' })
              }
            } else if (combatant.actor.type != 'PC') {
              toggleDefeatedStatus(combatant);
            }
            break;
          // Roll combatant initiative
          case "rollInitiative":
            return game.combat.rollInitiative([combatant.id]);
        }
      })
    });

    // Re-render combat when actors are modified.
    Hooks.on('updateActor', (actor, data, options, id) => {
      ui.combat.render();
    });

    Hooks.on('updateToken', (scene, token, data, options, id) => {
      if (data) {
        ui.combat.render();
      }
    });

    // When the combat tracker is rendered, we need to completely replace
    // its HTML with a custom version.
    Hooks.on('renderCombatTracker', async (app, html, options) => {
      // Find the combat element, which is where combatants are stored.
      let newHtml = html.find('#combat');
      if (newHtml.length < 1) {
        newHtml = html;
      }

      // If there's as combat, we can proceed.
      if (game.combat) {
        // Retrieve a list of the combatants grouped by actor type.
        let combatants = this.getCombatantsData();

        // Get the custom template.
        let template = 'modules/cyphercombat/templates/combat.hbs';
        let templateData = {
          combatants: combatants
        };

        // Render the template and update the markup with our new version.
        let content = await renderTemplate(template, templateData)
        newHtml.find('#combat-tracker').remove();
        newHtml.find('#combat-round').after(content);
      }
    });
  }

  /*
    Retrieve a list of combatants for the current combat. Combatants will be sorted into groups by actor type.
   */
  getCombatantsData() {
    // If there isn't a combat, exit and return an empty array.
    if (!game.combat || !game.combat.data) {
      return [];
    }

    // Reduce the combatants array into a new object with keys based on the actor types.
    let combatants = game.combat.data.combatants.filter((combatant) => {
      // If this is for a combatant that has had its token/actor deleted, remove it from the combat.
      if (!combatant.actor) {
        game.combat.deleteEmbeddedDocuments('Combatant', [combatant.id]);
      }
      // Append valid actors to the appropriate group.
      else {
        // Initialize the group if it doesn't exist.
        let type = combatant.actor.data.type;

        // Establish PC's damage track
        if (type == 'PC') {
          let damageTrack = combatant.actor.data.data.damage.damageTrack;
          combatant.dead = damageTrack == 'Dead';
          combatant.debilitated = damageTrack == 'Debilitated';
          combatant.impaired = damageTrack == 'Impaired';
          combatant.hale = damageTrack == 'Hale';
        }

        // Determine if combatant has rolled for initiative
        combatant.hasRolled = combatant.initiative !== null;

        // Set a property for whether or not this is editable. This controls whether editabel fields like HP will be shown as an input or a div in the combat tracker HTML template.
        combatant.isGM = game.user.isGM;
        combatant.isObserver = (combatant.actor.permission == 2) ? true : false;

        return true;
      }
    });

    // Sort the combatants by initiative.
    combatants.sort((a, b) => {
      return Number(b.initiative) - Number(a.initiative)
    });

    // Return the list of combatants.
    return combatants;
  }
}