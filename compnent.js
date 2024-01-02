import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { pick } from 'lodash';
import dataAids from '../../constants/dataAids';
import { UX2, constants } from '@wsb/guac-widget-core';
import Carousel from '@wsb/guac-widget-shared/lib/components/Carousel';
import { SLIDES } from '../../../../../constants/slideshowTypes';
import { DEFAULT_HEADER_IMAGE_OPACITY } from '../../../../../constants';
import BackgroundImage from '../../Media/BackgroundImage';
import SlideshowHero from '../../Slideshow/SlideshowHero';
import SlideshowDots from '../../Slideshow/SlideshowDots';
import SlideshowArrows from '../../Slideshow/SlideshowArrows';
import SlideshowEditControl from '../../Slideshow/SlideshowEditControl';
import { populateHeroContent } from '../../Slideshow/utils';

const {
  renderModes: { LAYOUT, DISPLAY, PUBLISH, EDIT }
} = constants;

const SLIDE_PATH_REGEX = [/mediaData\/slides\/(\d+).*/, /mediaData\/(\d+).*\/image/];
const DEFAULT_AUTOPLAY_TIME = 7000;
const MIN_AUTOPLAY_TIME = 2000;
const TEXT_FADE_DELAY = 800;

export default class BackgroundCarousel extends Component {
  constructor() {
    super(...arguments);
    this.state = {
      currentSlide: 0,
      showText: false,
      navOpen: false
    };
    this.afterChange = this.afterChange.bind(this);
    this.beforeChange = this.beforeChange.bind(this);
    this.handleNavDrawerOpened = this.handleNavDrawerOpened.bind(this);
    this.handleNavDrawerClosed = this.handleNavDrawerClosed.bind(this);
    this.getSlideEditingIndex = this.getSlideEditingIndex.bind(this);
    this._loadedImages = new Set();
  }

  fireTransitionEvent(slideIndex) {
    window.dispatchEvent(
      new CustomEvent('slideshowTransition', {
        detail: { slide: slideIndex, id: this.props.slideshow.themeConfig.slideshowId }
      })
    );
  }

  afterChange(currentSlide) {
    const { renderMode, slideshow } = this.props;
    const {
      type: slideshowType,
      themeConfig: { useHeroCarousel }
    } = slideshow;

    if (renderMode === PUBLISH && slideshowType === SLIDES && !useHeroCarousel) {
      populateHeroContent(slideshow, currentSlide);
    }

    this.setState(
      {
        currentSlide,
        showText: false
      },
      () => {
        setTimeout(() => {
          this.setState({ showText: true });
        }, TEXT_FADE_DELAY);
      }
    );
    this.fireTransitionEvent(currentSlide); // to sync after dragging
  }

  beforeChange(newIndex) {
    this.fireTransitionEvent(newIndex);
  }

  handleNavDrawerOpened() {
    this.setState({ navOpen: true });
  }

  handleNavDrawerClosed() {
    this.setState({ navOpen: false });
  }

  componentDidMount() {
    this.afterChange(0);
    window.addEventListener('NavigationDrawerOpened', this.handleNavDrawerOpened);
    window.addEventListener('NavigationDrawerClosed', this.handleNavDrawerClosed);
  }

  componentWillUnmount() {
    window.removeEventListener('NavigationDrawerOpened', this.handleNavDrawerOpened);
    window.removeEventListener('NavigationDrawerClosed', this.handleNavDrawerClosed);
  }

  getSlideEditingIndex(path = '') {
    const { renderMode } = this.props;
    if (renderMode === PUBLISH) {
      return -1;
    }

    let index = -1;
    SLIDE_PATH_REGEX.forEach(regex => {
      const match = path.match(regex);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
      }
    });
    return index;
  }

  render() {
    const { slideshow, renderMode, mutatorPath, dataRoute, viewDevice, ...otherProps } = this.props;
    const { currentSlide, showText, navOpen } = this.state;
    const {
      slides,
      type: slideshowType,
      autoplay,
      autoplayDelay,
      transition,
      dots,
      arrows,
      alignmentOption,
      heroIdPrefix,
      themeConfig
    } = slideshow;
    const {
      maxWidthPercent = 100,
      useHeroCarousel,
      dotsContainerId,
      arrowsContainerId,
      mobileArrowsContainerId
    } = themeConfig;
    const isPlaceholderRenderMode = [LAYOUT, DISPLAY].includes(renderMode);

    const backgroundStyle = {
      height: '100%'
    };

    let foundH1 = false;
    const indicesToRender = new Set(
      isPlaceholderRenderMode
        ? [0]
        : [
          currentSlide - 1 < 0 ? slides.length - 1 : currentSlide - 1,
          currentSlide,
          currentSlide + 1 === slides.length ? 0 : currentSlide + 1
        ]
    );
    const backgroundSlides = slides.map((slide, index) => {
      const slideData = slide || {};
      const background = slideData.image || {};
      const dataAid = `${dataAids.HEADER_SLIDE}_${index}`;
      const slideWidthPercent = arrows ? Math.min(maxWidthPercent, 80) : maxWidthPercent;

      let slideChildren;
      if (slideshowType === SLIDES && !useHeroCarousel) {
        let forceH1 = false;
        if (!foundH1 && slideData.tagline) {
          forceH1 = true;
          foundH1 = true;
        }
        slideChildren = (
          <SlideshowHero
            slide={ slideData }
            index={ index }
            forceH1={ forceH1 }
            alignmentOption={ alignmentOption }
            heroIdPrefix={ heroIdPrefix }
            themeConfig={ themeConfig }
            renderMode={ renderMode }
            currentSlide={ currentSlide }
            showText={ showText }
            slideWidthPercent={ slideWidthPercent }
            style={ backgroundStyle }
          />
        );
      }

      // Only render this image if it has a URL and is visible or has been rendered already
      if (
        background.image &&
        (this._loadedImages.has(background.image) || indicesToRender.has(index))
      ) {
        this._loadedImages.add(background.image);
        return (
          <BackgroundImage
            key={ index }
            data={{ overlayAlpha: DEFAULT_HEADER_IMAGE_OPACITY, ...background }} // normal default does not work w/ bootstrap
            { ...pick(otherProps, Object.keys(BackgroundImage.propTypes)) }
            style={ backgroundStyle }
            dataAid={ dataAid }
            dataRoute='' // we don't want BackgroundImage to use its default data-route
          >
            { slideChildren }
          </BackgroundImage>
        );
      }

      return (
        <UX2.Element.Block key={ index } style={ backgroundStyle } dataAid={ dataAid }>
          { slideChildren }
        </UX2.Element.Block>
      );
    });

    const parsedSlideSelection = this.getSlideEditingIndex(mutatorPath);
    const controlProps = {
      mobile: false,
      position: 'bottom',
      editingIndex: parsedSlideSelection,
      viewDevice,
      renderMode
    };

    const controls = [];
    if (dots) {
      controls.push({
        component: SlideshowDots,
        props: {
          ...controlProps,
          visible: !navOpen,
          containerId: dotsContainerId
        }
      });
    }
    if (arrows) {
      controls.push({
        component: SlideshowArrows,
        props: {
          ...controlProps,
          visible: !navOpen,
          containerId: arrowsContainerId,
          mobileContainerId: mobileArrowsContainerId
        }
      });
    }

    let shouldAutoplay = autoplay;
    if (isPlaceholderRenderMode || navOpen) {
      shouldAutoplay = false;
    } else if (renderMode === EDIT) {
      shouldAutoplay = autoplay && parsedSlideSelection === -1;
      const renderKey = currentSlide === parsedSlideSelection ? 0 : Math.random(); // force edit controls update to go to selected slide
      controls.push({
        component: SlideshowEditControl,
        props: { renderKey, editingIndex: parsedSlideSelection }
      });
    }

    const autoplayFloat = parseFloat(autoplayDelay);
    const autoplaySpeed = Number.isNaN(autoplayFloat)
      ? DEFAULT_AUTOPLAY_TIME
      : Math.max(1000 * autoplayFloat, MIN_AUTOPLAY_TIME);

    // disable dragging when all toggles are off to match perf optimization we use in publish mode
    // https://github.secureserver.net/PC/guac-widget-layouts/blob/062077e90119d596e53fdcd339c0762e286f7ee0/src/common/Components/Internal/Header/utils/applyDefaultProps.js#L90
    const draggable = shouldAutoplay || dots || arrows;

    const carouselProps = {
      style: {
        container: { height: '100%' },
        containerInner: { height: '100%' },
        track: { height: '100%' },
        ...(transition === 'slide'
          ? {
            slide: { opacity: 1 }
          }
          : {})
      },
      viewportWidth: '100%',
      viewportHeight: '100%',
      height: '100%',
      slideWidth: '100%',
      slideHeight: '100%',
      autoplay: shouldAutoplay,
      autoplaySpeed: autoplaySpeed,
      transition: transition,
      transitionDuration: 1000,
      infinite: true,
      lazyLoad: false,
      dots: false,
      arrows: false,
      draggable,
      pauseOnHover: false,
      afterChange: this.afterChange,
      beforeChange: this.beforeChange,
      controls: controls
    };

    return (
      <UX2.Element.Block style={{ height: '100%' }}>
        { renderMode === EDIT && (
          <UX2.Element.Block
            data-field-id={ dataRoute } // data-route can't be ancestor of carousel b/c it blocks arrow/dot interaction
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
            }}
          />
        ) }
        <Carousel { ...carouselProps }>{ backgroundSlides }</Carousel>
      </UX2.Element.Block>
    );
  }
}

BackgroundCarousel.propTypes = {
  slideshow: PropTypes.object,
  heroTrackId: PropTypes.string,
  dataRoute: PropTypes.string,
  renderMode: PropTypes.string,
  viewDevice: PropTypes.string,
  mutatorPath: PropTypes.string
};
